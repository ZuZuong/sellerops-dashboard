import type { Enums } from '@/shared/types/database.types'

/**
 * State machine của đơn hàng — NGUỒN DUY NHẤT phía client cho việc chuyển trạng thái.
 *
 *   pending ──► confirmed ──► shipping ──► delivered
 *      │            │
 *      └────────────┴──► cancelled
 *
 * Postgres RPC (`confirm_order`, `cancel_order`, `ship_order`, `deliver_order`) kiểm tra lại
 * cùng quy tắc trong transaction; ở client state machine dùng để ẩn / vô hiệu hóa thao tác
 * không hợp lệ và chặn gọi RPC sai trước khi tới server.
 */

export type OrderStatus = Enums<'order_status'>

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'shipping',
  'delivered',
  'cancelled',
] as const satisfies readonly OrderStatus[]

/** Nhãn tiếng Việt và màu Mantine cho từng trạng thái đơn. */
export const ORDER_STATUS_META: Readonly<Record<OrderStatus, { label: string; color: string }>> = {
  pending: { label: 'Chờ xác nhận', color: 'yellow' },
  confirmed: { label: 'Đã xác nhận', color: 'blue' },
  shipping: { label: 'Đang giao', color: 'indigo' },
  delivered: { label: 'Đã giao', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'gray' },
}

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
}

/** Luồng xử lý chính (không gồm hủy) — dùng để vẽ timeline. */
export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'shipping',
  'delivered',
] as const satisfies readonly OrderStatus[]

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function getNextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from]
}

/** Trạng thái cuối: không còn thao tác nào. */
export function isFinalStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0
}

export type StockEffect = 'deduct' | 'restock' | 'none'

/**
 * Tác động lên kho của một lần chuyển trạng thái (do RPC thực hiện, client chỉ hiển thị):
 * xác nhận → trừ kho; hủy đơn đã xác nhận → hoàn kho; còn lại không đổi.
 */
export function getStockEffect(from: OrderStatus, to: OrderStatus): StockEffect {
  if (!canTransition(from, to)) return 'none'
  if (to === 'confirmed') return 'deduct'
  if (to === 'cancelled' && from === 'confirmed') return 'restock'
  return 'none'
}

/** Trạng thái có thể chuyển tới (đích của một thao tác). */
export type OrderTransitionTarget = Exclude<OrderStatus, 'pending'>

export interface OrderActionMeta {
  /** Nhãn nút thao tác. */
  label: string
  color: string
  /** Thao tác cần hộp thoại xác nhận (tác động kho hoặc không hoàn tác được). */
  requiresConfirm: boolean
}

export const ORDER_ACTIONS: Readonly<Record<OrderTransitionTarget, OrderActionMeta>> = {
  confirmed: { label: 'Xác nhận đơn', color: 'blue', requiresConfirm: true },
  shipping: { label: 'Giao hàng', color: 'indigo', requiresConfirm: false },
  delivered: { label: 'Đã giao thành công', color: 'green', requiresConfirm: false },
  cancelled: { label: 'Hủy đơn', color: 'red', requiresConfirm: true },
}

export class InvalidTransitionError extends Error {
  readonly from: OrderStatus
  readonly to: OrderStatus

  constructor(from: OrderStatus, to: OrderStatus) {
    super('INVALID_STATUS_TRANSITION')
    this.name = 'InvalidTransitionError'
    this.from = from
    this.to = to
  }
}

/** Ném lỗi nếu chuyển trạng thái không hợp lệ (chặn trước khi gọi RPC). */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
): asserts to is OrderTransitionTarget {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}
