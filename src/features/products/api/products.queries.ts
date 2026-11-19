import { notifications } from '@mantine/notifications'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import { QUERY_ROOTS } from '@/shared/constants/queryRoots'
import { useSellerScope } from '@/shared/hooks/useSellerScope'
import { change, describeChanges, withChanges } from '@/shared/lib/activityChanges'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { activeLabel, productCreateChanges, productUpdateChanges } from '../lib/productActivity'
import type { ProductMedia } from '../lib/productImages'
import { getProductErrorMessage } from '../lib/productErrors'
import type { ProductFormValues } from '../schemas/product.schema'
import type { ProductFilters } from '../schemas/productFilters.schema'
import type { Product, ProductPage } from '../types'
import {
  createProduct,
  fetchProductInsight,
  fetchProducts,
  setProductActive,
  updateProduct,
  updateProductCost,
  updateProductPrice,
} from './products.api'
import {
  fetchImportedProducts,
  fetchProductImports,
  importProductsFromFile,
  type ImportFromFileInput,
} from './productImports.api'
import {
  countProductTrash,
  fetchProductTrash,
  findExistingProductNames,
  purgeTrash,
  restoreProducts,
  trashProducts,
} from './productTrash.api'

/**
 * Mọi key (trừ gốc `all`) chứa `sellerId` → cache không lẫn giữa các shop (admin xem nhiều shop).
 * Invalidate theo `productKeys.all` vẫn làm mới toàn bộ.
 */
export const productKeys = {
  all: [QUERY_ROOTS.products] as const,
  seller: (sellerId: string) => [...productKeys.all, sellerId] as const,
  lists: (sellerId: string) => [...productKeys.seller(sellerId), 'list'] as const,
  list: (sellerId: string, filters: ProductFilters) =>
    [...productKeys.lists(sellerId), filters] as const,
  insight: (sellerId: string, id: string) =>
    [...productKeys.seller(sellerId), 'insight', id] as const,
  imports: (sellerId: string) => [...productKeys.seller(sellerId), 'imports'] as const,
  importPage: (sellerId: string, page: number, pageSize: number) =>
    [...productKeys.imports(sellerId), 'page', page, pageSize] as const,
  importedProducts: (sellerId: string, importId: string) =>
    [...productKeys.imports(sellerId), 'products', importId] as const,
  trash: (sellerId: string) => [...productKeys.seller(sellerId), 'trash'] as const,
  trashPage: (sellerId: string, page: number, pageSize: number) =>
    [...productKeys.trash(sellerId), 'page', page, pageSize] as const,
  trashCount: (sellerId: string) => [...productKeys.trash(sellerId), 'count'] as const,
}

export function useProducts(filters: ProductFilters) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: productKeys.list(sellerId, filters),
    queryFn: () => fetchProducts(sellerId, filters),
    // Giữ trang cũ trong lúc tải trang mới / filter mới → bảng không nhảy về skeleton.
    placeholderData: keepPreviousData,
  })
}

/**
 * Sau khi sản phẩm thay đổi: làm mới mọi danh sách sản phẩm và dashboard
 * (KPI "sắp hết hàng", top sản phẩm phụ thuộc dữ liệu sản phẩm).
 */
function invalidateAfterProductChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: productKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  ])
}

function notifyError(title: string, error: unknown) {
  notifications.show({ color: 'red', title, message: getProductErrorMessage(error) })
}

export function useCreateProduct() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values, media }: { values: ProductFormValues; media: ProductMedia }) =>
      createProduct(sellerId, values, media),
    onSuccess: (product) => {
      notifications.show({
        color: 'green',
        title: product.is_active ? 'Đã đăng sản phẩm' : 'Đã thêm sản phẩm (chưa đăng)',
        message: `${product.name} · SKU ${product.sku}`,
        ...withChanges(productCreateChanges(product)),
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không thêm được sản phẩm', error),
  })
}

export function useUpdateProduct() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      product,
      values,
      media,
    }: {
      product: Product
      values: ProductFormValues
      media: ProductMedia
    }) => updateProduct(sellerId, product, values, media),
    onSuccess: (updated, { product: before }) => {
      const changes = productUpdateChanges(before, updated)
      notifications.show({
        color: 'green',
        title: 'Đã lưu thay đổi sản phẩm',
        message:
          changes.length > 0
            ? `${updated.name}\n${describeChanges(changes)}`
            : `${updated.name} · không có thay đổi`,
        ...withChanges(changes),
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không lưu được sản phẩm', error),
  })
}

export function useSetProductActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ product, isActive }: { product: Product; isActive: boolean }) =>
      setProductActive(product.id, isActive),
    onSuccess: (_data, { product, isActive }) => {
      notifications.show({
        color: 'green',
        title: isActive ? 'Đã đăng bán' : 'Đã ngừng bán',
        message: `${product.name}: ${activeLabel(product.is_active)} → ${activeLabel(isActive)}`,
        ...withChanges([
          change('Trạng thái', activeLabel(product.is_active), activeLabel(isActive)),
        ]),
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không cập nhật được trạng thái', error),
  })
}

/**
 * Xóa một hoặc nhiều sản phẩm → thùng rác. Sản phẩm đã có đơn hàng / phiếu nhập chỉ được
 * chuyển sang ngừng bán (giữ chứng từ) — thông báo nói rõ số lượng từng loại.
 */
export function useTrashProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (products: readonly Pick<Product, 'id' | 'name'>[]) =>
      trashProducts(products.map((p) => p.id)),
    onSuccess: ({ trashed, deactivated }, products) => {
      const single = products.length === 1 ? products[0]?.name : undefined
      const parts: string[] = []
      if (trashed > 0) {
        parts.push(`${formatNumber(trashed)} sản phẩm đã vào thùng rác (khôi phục trong 30 ngày).`)
      }
      if (deactivated > 0) {
        parts.push(
          `${formatNumber(deactivated)} sản phẩm đã có đơn hàng / phiếu nhập nên không xóa được — đã chuyển sang ngừng bán.`,
        )
      }
      notifications.show({
        color: trashed > 0 ? 'green' : 'orange',
        title: trashed > 0 ? (single ? `Đã xóa "${single}"` : 'Đã xóa sản phẩm') : 'Không xóa được',
        message: parts.join(' ') || 'Sản phẩm không còn tồn tại.',
        ...withChanges(products.map((p) => change('Sản phẩm', p.name, null))),
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không xóa được sản phẩm', error),
  })
}

export function useProductTrash(page: number, pageSize: number) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: productKeys.trashPage(sellerId, page, pageSize),
    queryFn: () => fetchProductTrash(sellerId, page, pageSize),
    placeholderData: keepPreviousData,
  })
}

export function useProductTrashCount() {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: productKeys.trashCount(sellerId),
    queryFn: () => countProductTrash(sellerId),
  })
}

export function useRestoreProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: readonly string[]) => restoreProducts(ids),
    onSuccess: ({ restored, skipped }) => {
      if (restored > 0) {
        notifications.show({
          color: 'green',
          title: `Đã khôi phục ${formatNumber(restored)} sản phẩm`,
          message: 'Sản phẩm đã trở lại danh sách với SKU và tồn kho như trước khi xóa.',
        })
      }
      if (skipped.length > 0) {
        notifications.show({
          color: 'orange',
          title: `${formatNumber(skipped.length)} sản phẩm chưa khôi phục được`,
          message: `Đã có sản phẩm khác cùng tên: ${skipped.join(', ')}. Đổi tên sản phẩm đang có rồi thử lại.`,
          autoClose: 10_000,
        })
      }
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không khôi phục được sản phẩm', error),
  })
}

export function usePurgeTrash() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: readonly string[]) => purgeTrash(ids),
    onSuccess: (count) => {
      notifications.show({
        color: 'green',
        title: 'Đã xóa vĩnh viễn',
        message: `${formatNumber(count)} sản phẩm đã bị xóa khỏi thùng rác.`,
      })
      return queryClient.invalidateQueries({ queryKey: productKeys.trash(sellerId) })
    },
    onError: (error) => notifyError('Không xóa vĩnh viễn được', error),
  })
}

/** Kiểm tra tên trùng trước khi nhập Excel (gọi theo yêu cầu, không cache). */
export function useFindExistingProductNames() {
  return useMutation({ mutationFn: findExistingProductNames })
}

export function useImportProducts() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ImportFromFileInput) => importProductsFromFile(sellerId, input),
    onSuccess: ({ count, publishedCount }, { file }) => {
      const draftCount = count - publishedCount
      const title =
        draftCount === 0
          ? 'Đã nhập và đăng sản phẩm'
          : publishedCount === 0
            ? 'Đã nhập sản phẩm (chưa đăng)'
            : `Đã đăng ${formatNumber(publishedCount)}, lưu chưa đăng ${formatNumber(draftCount)} sản phẩm`
      notifications.show({
        color: 'green',
        title,
        message: `${formatNumber(count)} sản phẩm từ "${file.name}" · xem lại trong Lịch sử import`,
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Nhập sản phẩm thất bại', error),
  })
}

export function useProductImports(page: number, pageSize: number) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: productKeys.importPage(sellerId, page, pageSize),
    queryFn: () => fetchProductImports(sellerId, page, pageSize),
    placeholderData: keepPreviousData,
  })
}

export function useImportedProducts(importId: string) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: productKeys.importedProducts(sellerId, importId),
    queryFn: () => fetchImportedProducts(sellerId, importId),
  })
}

export function useProductInsight(id: string) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: productKeys.insight(sellerId, id),
    queryFn: () => fetchProductInsight(id),
  })
}

// -----------------------------------------------------------------------------
// Sửa nhanh có optimistic update
// -----------------------------------------------------------------------------

type ListSnapshot = Array<[readonly unknown[], ProductPage | undefined]>

/**
 * Áp thay đổi lên mọi danh sách đang cache ngay lập tức; trả snapshot để rollback nếu lỗi.
 * Hủy request đang chạy trước để response cũ không ghi đè lên giá trị optimistic.
 */
async function patchProductInLists(
  queryClient: QueryClient,
  sellerId: string,
  id: string,
  patch: Partial<Product>,
): Promise<ListSnapshot> {
  const queryKey = productKeys.lists(sellerId)
  await queryClient.cancelQueries({ queryKey })
  const snapshot = queryClient.getQueriesData<ProductPage>({ queryKey })
  queryClient.setQueriesData<ProductPage>({ queryKey }, (page) =>
    page ? { ...page, items: page.items.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : page,
  )
  return snapshot
}

function rollback(queryClient: QueryClient, snapshot: ListSnapshot | undefined) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data))
}

export function useQuickUpdateCost() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ product, costPrice }: { product: Product; costPrice: number }) =>
      updateProductCost(product.id, costPrice),
    onMutate: async ({ product, costPrice }) => ({
      snapshot: await patchProductInLists(queryClient, sellerId, product.id, {
        cost_price: costPrice,
      }),
    }),
    onSuccess: (_data, { product, costPrice }) => {
      notifications.show({
        color: 'green',
        title: 'Đã cập nhật giá vốn',
        message: `${product.name}: ${formatCurrency(product.cost_price)} → ${formatCurrency(costPrice)}`,
        ...withChanges([
          change('Giá vốn', formatCurrency(product.cost_price), formatCurrency(costPrice)),
        ]),
      })
    },
    onError: (error, _vars, context) => {
      rollback(queryClient, context?.snapshot)
      notifyError('Không cập nhật được giá vốn', error)
    },
    onSettled: () => invalidateAfterProductChange(queryClient),
  })
}

export function useQuickUpdatePrice() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ product, price }: { product: Product; price: number }) =>
      updateProductPrice(product.id, price),
    onMutate: async ({ product, price }) => ({
      snapshot: await patchProductInLists(queryClient, sellerId, product.id, { price }),
    }),
    onSuccess: (_data, { product, price }) => {
      notifications.show({
        color: 'green',
        title: 'Đã cập nhật giá bán',
        message: `${product.name}: ${formatCurrency(product.price)} → ${formatCurrency(price)}`,
        ...withChanges([change('Giá bán', formatCurrency(product.price), formatCurrency(price))]),
      })
    },
    onError: (error, _vars, context) => {
      rollback(queryClient, context?.snapshot)
      notifyError('Không cập nhật được giá', error)
    },
    onSettled: () => invalidateAfterProductChange(queryClient),
  })
}
