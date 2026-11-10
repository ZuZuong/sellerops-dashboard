import type { Enums } from '@/shared/types/database.types'

export type OrderStatus = Enums<'order_status'>

/** Nhãn tiếng Việt và màu Mantine cho từng trạng thái đơn. */
export const ORDER_STATUS_META: Readonly<Record<OrderStatus, { label: string; color: string }>> = {
  pending: { label: 'Chờ xác nhận', color: 'yellow' },
  confirmed: { label: 'Đã xác nhận', color: 'blue' },
  shipping: { label: 'Đang giao', color: 'indigo' },
  delivered: { label: 'Đã giao', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'gray' },
}
