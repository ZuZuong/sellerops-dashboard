import type { OrderItem } from '../types'

/**
 * Giá vốn hàng bán của đơn = Σ số lượng × giá vốn đã chốt khi xác nhận.
 * `null` khi chưa chốt (đơn chưa xác nhận) — chưa có giá vốn để tính lợi nhuận.
 */
export function orderCogs(
  items: readonly Pick<OrderItem, 'quantity' | 'unit_cost'>[],
): number | null {
  if (items.length === 0 || items.some((item) => item.unit_cost === null)) return null
  return Math.round(items.reduce((sum, item) => sum + item.quantity * (item.unit_cost ?? 0), 0))
}
