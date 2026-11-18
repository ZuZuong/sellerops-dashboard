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
import { change, withChanges, type ActivityChange } from '@/shared/lib/activityChanges'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { ORDER_STATUS_META, type OrderStatus } from '../domain/orderStatus'
import { getPaymentMethodLabel } from '../domain/paymentMethod'
import { calcOrderTotal } from '../lib/orderTotal'
import { getOrderErrorMessage } from '../lib/orderErrors'
import { toCreateOrderPayload, type CreateOrderValues } from '../schemas/order.schema'
import type { OrderFilters } from '../schemas/orderFilters.schema'
import type { Order, OrderItem } from '../types'
import {
  createOrder,
  fetchOrderDetail,
  fetchOrders,
  searchOrderableProducts,
  searchSavedCustomers,
  transitionOrder,
} from './orders.api'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  orderableProducts: (q: string) => [...orderKeys.all, 'orderable-products', q] as const,
  savedCustomers: (q: string) => [...orderKeys.all, 'saved-customers', q] as const,
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

export function useSavedCustomers(q: string, enabled = true) {
  return useQuery({
    queryKey: orderKeys.savedCustomers(q),
    queryFn: () => searchSavedCustomers(q),
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
        message: values.save_customer
          ? `Đơn của ${values.customer_name} đang chờ xác nhận · đã lưu thông tin khách`
          : `Đơn của ${values.customer_name} đang chờ xác nhận`,
        ...withChanges(createOrderChanges(values)),
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

/** Tạo đơn: thông tin khách, thanh toán, từng dòng hàng và tạm tính (cũ = trống). */
function createOrderChanges(values: CreateOrderValues): ActivityChange[] {
  const total = calcOrderTotal(
    values.items.map((item) => ({ price: item.product?.price, quantity: item.quantity })),
  )
  return [
    change('Khách hàng', null, values.customer_name),
    change('Điện thoại', null, values.customer_phone),
    change('Địa chỉ giao', null, values.shipping_address),
    change('Thanh toán', null, getPaymentMethodLabel(values.payment_method)),
    change('Trạng thái', null, ORDER_STATUS_META.pending.label),
    ...values.items.flatMap(({ product, quantity }) =>
      product
        ? [
            change(
              product.name,
              null,
              `${formatNumber(quantity)} × ${formatCurrency(product.price)}`,
            ),
          ]
        : [],
    ),
    change('Tạm tính', null, formatCurrency(total)),
  ]
}

/** Chuyển trạng thái: trạng thái cũ → mới; xác nhận / hủy đơn đã xác nhận kèm biến động tồn kho. */
function transitionChanges(
  from: OrderStatus,
  to: OrderStatus,
  items: readonly OrderItem[] | undefined,
): ActivityChange[] {
  const changes = [change('Trạng thái', ORDER_STATUS_META[from].label, ORDER_STATUS_META[to].label)]
  const direction = to === 'confirmed' ? -1 : to === 'cancelled' && from === 'confirmed' ? 1 : 0
  if (direction !== 0) {
    for (const item of items ?? []) {
      if (!item.product) continue
      const before = item.product.stock
      changes.push(
        change(
          `Tồn kho ${item.product.name}`,
          formatNumber(before),
          formatNumber(before + direction * item.quantity),
        ),
      )
    }
  }
  return changes
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
    onSuccess: (_data, { order, to, items }) => {
      notifications.show({
        color: 'green',
        title: SUCCESS_TITLES[to] ?? 'Đã cập nhật đơn hàng',
        message: `${order.code}: ${ORDER_STATUS_META[order.status].label} → ${ORDER_STATUS_META[to].label}`,
        ...withChanges(transitionChanges(order.status, to, items)),
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
