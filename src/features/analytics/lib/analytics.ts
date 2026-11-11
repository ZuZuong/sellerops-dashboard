import { toCsv } from '@/shared/lib/csv'
import type { CategoryRevenue, DailyRevenue, StockLedgerRow } from '../types'

export const UNCATEGORIZED_LABEL = 'Chưa phân loại'
export const OTHER_LABEL = 'Khác'

export interface CategorySlice {
  label: string
  revenue: number
  gross_profit: number
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
    gross_profit: row.gross_profit,
    quantity: row.quantity,
  }))
  if (tail.length > 0) {
    slices.push({
      label: OTHER_LABEL,
      revenue: tail.reduce((sum, row) => sum + row.revenue, 0),
      gross_profit: tail.reduce((sum, row) => sum + row.gross_profit, 0),
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
    { header: 'Giá vốn hàng bán (VND)', value: (row) => row.cogs },
    { header: 'Lợi nhuận gộp (VND)', value: (row) => row.gross_profit },
    { header: 'Số đơn', value: (row) => row.order_count },
  ])
}

export interface StockLedgerTotals {
  opening_value: number
  in_qty: number
  in_value: number
  out_qty: number
  out_value: number
  closing_value: number
}

/** Cộng dòng tổng của báo cáo xuất nhập tồn (chỉ cộng giá trị; số lượng khác ĐVT không cộng chung). */
export function stockLedgerTotals(rows: readonly StockLedgerRow[]): StockLedgerTotals {
  return rows.reduce<StockLedgerTotals>(
    (acc, row) => ({
      opening_value: acc.opening_value + row.opening_value,
      in_qty: acc.in_qty + row.in_qty,
      in_value: acc.in_value + row.in_value,
      out_qty: acc.out_qty + row.out_qty,
      out_value: acc.out_value + row.out_value,
      closing_value: acc.closing_value + row.closing_value,
    }),
    { opening_value: 0, in_qty: 0, in_value: 0, out_qty: 0, out_value: 0, closing_value: 0 },
  )
}

/** CSV "Báo cáo xuất nhập tồn": SL + giá trị (theo giá vốn) của tồn đầu, nhập, xuất, tồn cuối. */
export function stockLedgerToCsv(rows: readonly StockLedgerRow[]): string {
  return toCsv(rows, [
    { header: 'SKU', value: (row) => row.sku },
    { header: 'Tên sản phẩm', value: (row) => row.name },
    { header: 'ĐVT', value: (row) => row.unit },
    { header: 'Tồn đầu kỳ - SL', value: (row) => row.opening_qty },
    { header: 'Tồn đầu kỳ - Giá trị (VND)', value: (row) => row.opening_value },
    { header: 'Nhập trong kỳ - SL', value: (row) => row.in_qty },
    { header: 'Nhập trong kỳ - Giá trị (VND)', value: (row) => row.in_value },
    { header: 'Xuất trong kỳ - SL', value: (row) => row.out_qty },
    { header: 'Xuất trong kỳ - Giá trị (VND)', value: (row) => row.out_value },
    { header: 'Tồn cuối kỳ - SL', value: (row) => row.closing_qty },
    { header: 'Tồn cuối kỳ - Giá trị (VND)', value: (row) => row.closing_value },
  ])
}
