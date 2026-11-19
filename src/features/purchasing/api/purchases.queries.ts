import { notifications } from '@mantine/notifications'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import { productKeys } from '@/features/products'
import { useSellerScope } from '@/shared/hooks/useSellerScope'
import { change, withChanges, type ActivityChange } from '@/shared/lib/activityChanges'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { receiptTotals } from '../domain/costing'
import { getReceiptErrorMessage } from '../lib/receiptErrors'
import { toReceiptPayload, type ReceiptFormValues } from '../schemas/receipt.schema'
import type { ReceiptFilters } from '../schemas/receiptFilters.schema'
import {
  deleteReceipt,
  fetchReceipt,
  fetchReceipts,
  postReceipt,
  saveReceipt,
  searchReceiptProducts,
} from './purchases.api'

export const purchaseKeys = {
  all: ['purchases'] as const,
  seller: (sellerId: string) => [...purchaseKeys.all, sellerId] as const,
  lists: (sellerId: string) => [...purchaseKeys.seller(sellerId), 'list'] as const,
  list: (sellerId: string, filters: ReceiptFilters) =>
    [...purchaseKeys.lists(sellerId), filters] as const,
  detail: (sellerId: string, id: string) =>
    [...purchaseKeys.seller(sellerId), 'detail', id] as const,
  products: (sellerId: string, q: string) =>
    [...purchaseKeys.seller(sellerId), 'products', q] as const,
}

export function useReceipts(filters: ReceiptFilters) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: purchaseKeys.list(sellerId, filters),
    queryFn: () => fetchReceipts(sellerId, filters),
    placeholderData: keepPreviousData,
  })
}

export function useReceipt(id: string) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: purchaseKeys.detail(sellerId, id),
    queryFn: () => fetchReceipt(sellerId, id),
  })
}

export function useReceiptProducts(q: string, enabled: boolean) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: purchaseKeys.products(sellerId, q),
    queryFn: () => searchReceiptProducts(sellerId, q),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/**
 * Nhập kho làm thay đổi tồn kho + giá vốn (sản phẩm, kho, dashboard, báo cáo nằm dưới các key
 * này) → làm mới tất cả.
 */
function invalidateAfterReceiptChange(queryClient: QueryClient, posted: boolean) {
  const tasks = [queryClient.invalidateQueries({ queryKey: purchaseKeys.all })]
  if (posted) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    )
  }
  return Promise.all(tasks)
}

/**
 * Phiếu nhập: nhà cung cấp, tổng tiền; khi nhập kho thêm tồn kho từng sản phẩm cũ → mới
 * (theo số tồn lúc thao tác + SL thực nhận).
 */
function receiptChanges(values: ReceiptFormValues, post: boolean): ActivityChange[] {
  const totals = receiptTotals(values.items)
  return [
    change('Nhà cung cấp', null, values.supplier_name),
    change('Tổng tiền', null, formatCurrency(totals.amount)),
    change('Trạng thái phiếu', null, post ? 'Đã nhập kho' : 'Nháp'),
    ...values.items.flatMap(({ product, received_qty, unit_cost }) => {
      if (!product) return []
      return post
        ? [
            change(
              `Tồn kho ${product.name}`,
              formatNumber(product.stock),
              formatNumber(product.stock + received_qty),
            ),
          ]
        : [
            change(
              product.name,
              null,
              `${formatNumber(received_qty)} × ${formatCurrency(unit_cost ?? 0)}`,
            ),
          ]
    }),
  ]
}

export interface SaveReceiptVariables {
  id: string | null
  values: ReceiptFormValues
  /** true = lưu rồi duyệt nhập kho ngay. */
  post: boolean
}

/**
 * Lưu nháp, hoặc lưu + duyệt nhập kho. Hai bước là hai RPC: nếu duyệt lỗi (vd. sản phẩm vừa bị
 * xóa) thì phiếu vẫn được giữ ở dạng nháp với nội dung mới nhất.
 */
export function useSaveReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values, post }: SaveReceiptVariables) => {
      const savedId = await saveReceipt(id, toReceiptPayload(values))
      if (post) await postReceipt(savedId)
      return savedId
    },
    onSuccess: (_id, { values, post }) => {
      const totals = receiptTotals(values.items)
      notifications.show({
        color: 'green',
        title: post ? 'Đã nhập kho' : 'Đã lưu phiếu nháp',
        message: post
          ? `${formatNumber(totals.received)} sản phẩm · ${formatCurrency(totals.amount)} từ ${values.supplier_name}`
          : `${values.supplier_name} · chưa cộng vào tồn kho`,
        ...withChanges(receiptChanges(values, post)),
      })
    },
    onError: (error, { post }) => {
      notifications.show({
        color: 'red',
        title: post ? 'Không nhập kho được' : 'Không lưu được phiếu nhập',
        message: getReceiptErrorMessage(error),
      })
    },
    onSettled: (_id, _error, { post }) => invalidateAfterReceiptChange(queryClient, post),
  })
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; code: string }) => deleteReceipt(id),
    onSuccess: (_data, { code }) => {
      notifications.show({
        color: 'green',
        title: 'Đã xóa phiếu nháp',
        message: code,
        ...withChanges([change('Phiếu nhập', code, null)]),
      })
      return invalidateAfterReceiptChange(queryClient, false)
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không xóa được phiếu',
        message: getReceiptErrorMessage(error),
      })
    },
  })
}
