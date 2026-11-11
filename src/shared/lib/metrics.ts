/**
 * Tỉ lệ thay đổi so với kỳ trước (0.25 = +25%).
 * Trả về `null` khi kỳ trước bằng 0 — không có mốc so sánh, UI hiển thị "Chưa có dữ liệu kỳ trước"
 * thay vì một con số vô nghĩa như +∞%.
 */
export function calcChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null
  return (current - previous) / previous
}

export type Trend = 'up' | 'down' | 'flat'

export function getTrend(change: number | null): Trend | null {
  if (change === null) return null
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'flat'
}

/**
 * Biên lợi nhuận gộp = lợi nhuận gộp / doanh thu (0.3 = 30%).
 * `null` khi chưa có doanh thu — không hiển thị con số vô nghĩa.
 */
export function calcMargin(profit: number, revenue: number): number | null {
  if (!Number.isFinite(profit) || !Number.isFinite(revenue) || revenue <= 0) return null
  return profit / revenue
}
