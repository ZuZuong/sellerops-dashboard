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
import { ORDER_STATUS_META, type OrderStatus } from '../domain/orderStatus'
import { getOrderErrorMessage } from '../lib/orderErrors'
import { toCreateOrderPayload, type CreateOrderValues } from '../schemas/order.schema'
import type { OrderFilters } from '../schemas/orderFilters.schema'
import type { Order, OrderItem } from '../types'
import {
  createOrder,
  fetchOrderDetail,
  fetchOrders,
  searchOrderableProducts,
  transitionOrder,
} from './orders.api'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  orderableProducts: (q: string) => [...orderKeys.all, 'orderable-products', q] as const,
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => fetchOrders(filters),
    // Giữ trang cũ trong lúc tải trang / filter mới → bảng không nhảy về skeleton.
    placeholderData: keepPreviousData,
  })
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: () => fetchOrderDetail(orderId),
  })
}

export function useOrderableProducts(q: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.orderableProducts(q),
    queryFn: () => searchOrderableProducts(q),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/**
 * Đơn hàng thay đổi kéo theo: danh sách / chi tiết đơn, tồn kho sản phẩm (xác nhận / hủy)
 * và số liệu dashboard (doanh thu, đơn chờ xử lý, sắp hết hàng).
 */
function invalidateAfterOrderChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: orderKeys.all }),
    queryClient.invalidateQueries({ queryKey: productKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  ])
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: CreateOrderValues) => createOrder(toCreateOrderPayload(values)),
    onSuccess: (_id, values) => {
      notifications.show({
        color: 'green',
        title: 'Đã tạo đơn hàng',
        message: `Đơn của ${values.customer_name} đang chờ xác nhận`,
      })
      return invalidateAfterOrderChange(queryClient)
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không tạo được đơn hàng',
        message: getOrderErrorMessage(error),
      })
    },
  })
}

export interface TransitionVariables {
  order: Pick<Order, 'id' | 'code' | 'status'>
  to: OrderStatus
  /** Dòng hàng (nếu có) để thông báo lỗi thiếu hàng nêu đúng tên sản phẩm. */
  items?: readonly OrderItem[]
}

const SUCCESS_TITLES: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Đã xác nhận đơn hàng',
  shipping: 'Đơn hàng đang được giao',
  delivered: 'Đơn hàng đã giao thành công',
  cancelled: 'Đã hủy đơn hàng',
}

export function useTransitionOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ order, to }: TransitionVariables) => transitionOrder(order.id, order.status, to),
    onSuccess: (_data, { order, to }) => {
      notifications.show({
        color: 'green',
        title: SUCCESS_TITLES[to] ?? 'Đã cập nhật đơn hàng',
        message: `${order.code} · ${ORDER_STATUS_META[to].label}`,
      })
    },
    onError: (error, { order, items }) => {
      const productNames = new Map(
        (items ?? []).flatMap((item): Array<[string, string]> =>
          item.product ? [[item.product_id, item.product.name]] : [],
        ),
      )
      notifications.show({
        color: 'red',
        title: `Không cập nhật được đơn ${order.code}`,
        message: getOrderErrorMessage(error, productNames),
      })
    },
    // Lỗi cũng làm mới: trạng thái / tồn kho trên server có thể đã khác dữ liệu đang hiển thị.
    onSettled: () => invalidateAfterOrderChange(queryClient),
  })
}
