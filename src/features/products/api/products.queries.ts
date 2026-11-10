import { notifications } from '@mantine/notifications'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import type { ProductMedia } from '../lib/productImages'
import { getProductErrorMessage } from '../lib/productErrors'
import type { ImportedProduct, ProductFormValues } from '../schemas/product.schema'
import type { ProductFilters } from '../schemas/productFilters.schema'
import type { Product, ProductPage } from '../types'
import {
  adjustProductStock,
  createProduct,
  createProducts,
  deleteProduct,
  fetchProducts,
  setProductActive,
  updateProduct,
  updateProductPrice,
} from './products.api'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
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
    onSuccess: (product) => {
      notifications.show({ color: 'green', title: 'Đã lưu thay đổi', message: product.name })
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
        message: product.name,
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không cập nhật được trạng thái', error),
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: (_data, product) => {
      notifications.show({ color: 'green', title: 'Đã xóa sản phẩm', message: product.name })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Không xóa được sản phẩm', error),
  })
}

export function useImportProducts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ products, publish }: { products: ImportedProduct[]; publish: boolean }) =>
      createProducts(products, publish),
    onSuccess: (count, { publish }) => {
      notifications.show({
        color: 'green',
        title: publish ? 'Đã nhập và đăng sản phẩm' : 'Đã nhập sản phẩm (chưa đăng)',
        message: `${formatNumber(count)} sản phẩm từ file Excel`,
      })
      return invalidateAfterProductChange(queryClient)
    },
    onError: (error) => notifyError('Nhập sản phẩm thất bại', error),
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
        title: 'Đã cập nhật giá',
        message: `${product.name}: ${formatCurrency(price)}`,
      })
    },
    onError: (error, _vars, context) => {
      rollback(queryClient, context?.snapshot)
      notifyError('Không cập nhật được giá', error)
    },
    onSettled: () => invalidateAfterProductChange(queryClient),
  })
}

export const QUICK_STOCK_NOTE = 'Sửa nhanh từ danh sách sản phẩm'

export function useQuickAdjustStock() {
  const queryClient = useQueryClient()
  return useMutation({
    // Chuyển "tồn kho mới" thành delta để DB kiểm tra & ghi lịch sử trong một transaction.
    mutationFn: ({ product, stock }: { product: Product; stock: number }) =>
      adjustProductStock(product.id, stock - product.stock, QUICK_STOCK_NOTE),
    onMutate: async ({ product, stock }) => ({
      snapshot: await patchProductInLists(queryClient, product.id, {
        stock,
        is_low_stock: stock <= product.low_stock_threshold,
      }),
    }),
    onSuccess: (newStock, { product }) => {
      notifications.show({
        color: 'green',
        title: 'Đã cập nhật tồn kho',
        message: `${product.name}: ${formatNumber(newStock)}`,
      })
    },
    onError: (error, _vars, context) => {
      rollback(queryClient, context?.snapshot)
      notifyError('Không cập nhật được tồn kho', error)
    },
    onSettled: () => invalidateAfterProductChange(queryClient),
  })
}
