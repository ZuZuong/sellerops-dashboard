import { ORDER_STATUS_FLOW, type OrderStatus } from './orderStatus'

export interface TimelineStep {
  status: OrderStatus
  /** Thời điểm đạt trạng thái; null nếu chưa tới (hoặc không có lịch sử). */
  at: string | null
  done: boolean
}

interface StatusEvent {
  status: OrderStatus
  created_at: string
}

/**
 * Dựng timeline trạng thái cho trang chi tiết.
 * - Đơn bình thường: luôn hiện đủ luồng pending → confirmed → shipping → delivered, các bước đã qua
 *   có mốc thời gian, bước chưa tới để trống.
 * - Đơn đã hủy: chỉ hiện các bước thực sự đã đi qua rồi kết thúc ở "Đã hủy".
 */
export function buildOrderTimeline(
  status: OrderStatus,
  events: readonly StatusEvent[],
  createdAt: string,
): TimelineStep[] {
  // Mốc đầu tiên của mỗi trạng thái (events đã sắp xếp tăng dần theo thời gian).
  const firstAt = new Map<OrderStatus, string>()
  for (const event of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!firstAt.has(event.status)) firstAt.set(event.status, event.created_at)
  }
  // Đơn luôn bắt đầu ở pending lúc tạo, kể cả khi thiếu event.
  if (!firstAt.has('pending')) firstAt.set('pending', createdAt)

  if (status === 'cancelled') {
    const reached = ORDER_STATUS_FLOW.filter((s) => firstAt.has(s))
    return [...reached, 'cancelled' as const].map((s) => ({
      status: s,
      at: firstAt.get(s) ?? null,
      done: true,
    }))
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status)
  return ORDER_STATUS_FLOW.map((s, index) => ({
    status: s,
    at: index <= currentIndex ? (firstAt.get(s) ?? null) : null,
    done: index <= currentIndex,
  }))
}
