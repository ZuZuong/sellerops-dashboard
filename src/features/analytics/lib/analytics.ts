import { toCsv } from '@/shared/lib/csv'
import type { CategoryRevenue, DailyRevenue } from '../types'

export const UNCATEGORIZED_LABEL = 'Chưa phân loại'
export const OTHER_LABEL = 'Khác'

export interface CategorySlice {
  label: string
  revenue: number
  quantity: number
  /** Tỉ trọng doanh thu (0–1). */
  share: number
}

/**
 * Chuẩn bị dữ liệu biểu đồ theo danh mục: sắp giảm dần theo doanh thu, giữ `max - 1` danh mục
 * lớn nhất và gộp phần còn lại vào "Khác" (biểu đồ không bị dài vô hạn, nhãn đọc được).
 */
export function foldCategories(rows: readonly CategoryRevenue[], max = 8): CategorySlice[] {
  const total = rows.reduce((sum, row) => sum + row.revenue, 0)
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue)
  const head = sorted.length > max ? sorted.slice(0, max - 1) : sorted
  const tail = sorted.length > max ? sorted.slice(max - 1) : []

  const slices = head.map((row) => ({
    label: row.category ?? UNCATEGORIZED_LABEL,
    revenue: row.revenue,
    quantity: row.quantity,
  }))
  if (tail.length > 0) {
    slices.push({
      label: OTHER_LABEL,
      revenue: tail.reduce((sum, row) => sum + row.revenue, 0),
      quantity: tail.reduce((sum, row) => sum + row.quantity, 0),
    })
  }
  return slices.map((slice) => ({ ...slice, share: total > 0 ? slice.revenue / total : 0 }))
}

/** Giá trị trung bình mỗi đơn; 0 đơn → 0 (không chia cho 0). */
export function averageOrderValue(revenue: number, orderCount: number): number {
  return orderCount > 0 ? Math.round(revenue / orderCount) : 0
}

/** CSV doanh thu theo ngày; ngày dạng YYYY-MM-DD để Excel nhận đúng kiểu ngày. */
export function revenueToCsv(rows: readonly DailyRevenue[]): string {
  return toCsv(rows, [
    { header: 'Ngày', value: (row) => row.day },
    { header: 'Doanh thu (VND)', value: (row) => row.revenue },
    { header: 'Số đơn', value: (row) => row.order_count },
  ])
}
