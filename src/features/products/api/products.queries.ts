import { notifications } from '@mantine/notifications'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
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
  createProductCategory,
  deleteProductCategory,
  fetchProductCategories,
  renameProductCategory,
} from './productCategories.api'
import {
  countProductTrash,
  fetchProductTrash,
  findExistingProductNames,
  purgeTrash,
  restoreProducts,
  trashProducts,
} from './productTrash.api'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  insight: (id: string) => [...productKeys.all, 'insight', id] as const,
  imports: () => [...productKeys.all, 'imports'] as const,
  importPage: (page: number, pageSize: number) =>
    [...productKeys.imports(), 'page', page, pageSize] as const,
  importedProducts: (importId: string) => [...productKeys.imports(), 'products', importId] as const,
  trash: () => [...productKeys.all, 'trash'] as const,
  trashPage: (page: number, pageSize: number) =>
    [...productKeys.trash(), 'page', page, pageSize] as const,
  trashCount: () => [...productKeys.trash(), 'count'] as const,
  categories: () => [...productKeys.all, 'categories'] as const,
}

const categoriesQuery = {
  queryKey: productKeys.categories(),
  queryFn: fetchProductCategories,
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => fetchProducts(filters),
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values, media }: { values: ProductFormValues; media: ProductMedia }) =>
      createProduct(values, media),
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
    }) => updateProduct(product, values, media),
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
  return useQuery({
    queryKey: productKeys.trashPage(page, pageSize),
    queryFn: () => fetchProductTrash(page, pageSize),
    placeholderData: keepPreviousData,
  })
}

export function useProductTrashCount() {
  return useQuery({ queryKey: productKeys.trashCount(), queryFn: countProductTrash })
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: readonly string[]) => purgeTrash(ids),
    onSuccess: (count) => {
      notifications.show({
        color: 'green',
        title: 'Đã xóa vĩnh viễn',
        message: `${formatNumber(count)} sản phẩm đã bị xóa khỏi thùng rác.`,
      })
      return queryClient.invalidateQueries({ queryKey: productKeys.trash() })
    },
    onError: (error) => notifyError('Không xóa vĩnh viễn được', error),
  })
}

/** Kiểm tra tên trùng trước khi nhập Excel (gọi theo yêu cầu, không cache). */
export function useFindExistingProductNames() {
  return useMutation({ mutationFn: findExistingProductNames })
}

export function useImportProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ImportFromFileInput) => importProductsFromFile(input),
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
  return useQuery({
    queryKey: productKeys.importPage(page, pageSize),
    queryFn: () => fetchProductImports(page, pageSize),
    placeholderData: keepPreviousData,
  })
}

export function useImportedProducts(importId: string) {
  return useQuery({
    queryKey: productKeys.importedProducts(importId),
    queryFn: () => fetchImportedProducts(importId),
  })
}

export function useProductInsight(id: string) {
  return useQuery({ queryKey: productKeys.insight(id), queryFn: () => fetchProductInsight(id) })
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
  id: string,
  patch: Partial<Product>,
): Promise<ListSnapshot> {
  await queryClient.cancelQueries({ queryKey: productKeys.lists() })
  const snapshot = queryClient.getQueriesData<ProductPage>({ queryKey: productKeys.lists() })
  queryClient.setQueriesData<ProductPage>({ queryKey: productKeys.lists() }, (page) =>
    page ? { ...page, items: page.items.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : page,
  )
  return snapshot
}

function rollback(queryClient: QueryClient, snapshot: ListSnapshot | undefined) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data))
}

export function useQuickUpdateCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ product, costPrice }: { product: Product; costPrice: number }) =>
      updateProductCost(product.id, costPrice),
    onMutate: async ({ product, costPrice }) => ({
      snapshot: await patchProductInLists(queryClient, product.id, { cost_price: costPrice }),
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ product, price }: { product: Product; price: number }) =>
      updateProductPrice(product.id, price),
    onMutate: async ({ product, price }) => ({
      snapshot: await patchProductInLists(queryClient, product.id, { price }),
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

// -----------------------------------------------------------------------------
// Danh mục
// -----------------------------------------------------------------------------

/** Danh mục kèm số sản phẩm (trang Danh mục). */
export function useProductCategories() {
  return useQuery(categoriesQuery)
}

/** Chỉ tên danh mục (A → Z) — cho ô chọn ở form / bộ lọc. */
export function useProductCategoryNames() {
  return useQuery({ ...categoriesQuery, select: (rows) => rows.map((row) => row.name) })
}

/** Lấy tên danh mục khi cần ngay (đọc file Excel, tạo file mẫu): dùng cache nếu đã có. */
export function useLoadCategoryNames() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.ensureQueryData(categoriesQuery).then((rows) => rows.map((row) => row.name))
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createProductCategory(name),
    onSuccess: (_id, name) => {
      notifications.show({
        color: 'green',
        title: 'Đã thêm danh mục',
        message: name.trim(),
        ...withChanges([change('Danh mục', null, name.trim())]),
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không thêm được danh mục', error),
  })
}

export function useRenameProductCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string; oldName: string }) =>
      renameProductCategory(id, name),
    onSuccess: (_data, { name, oldName }) => {
      notifications.show({
        color: 'green',
        title: 'Đã đổi tên danh mục',
        message: `"${oldName}" → "${name.trim()}". Sản phẩm trong danh mục đã được cập nhật theo.`,
        ...withChanges([change('Tên danh mục', oldName, name.trim())]),
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không đổi tên được danh mục', error),
  })
}

export function useDeleteProductCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteProductCategory(id),
    onSuccess: ({ products, unpublished }, { name }) => {
      notifications.show({
        color: products > 0 ? 'orange' : 'green',
        title: `Đã xóa danh mục "${name}"`,
        ...withChanges([change('Danh mục', name, null)]),
        message:
          products === 0
            ? 'Không có sản phẩm nào dùng danh mục này.'
            : `${formatNumber(products)} sản phẩm cần chọn lại danh mục` +
              (unpublished > 0
                ? `; ${formatNumber(unpublished)} sản phẩm đang bán đã chuyển về lưu chưa đăng.`
                : '.'),
        autoClose: products > 0 ? 10_000 : undefined,
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không xóa được danh mục', error),
  })
}
