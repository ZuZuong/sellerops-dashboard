import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { supabase } from '@/shared/lib/supabase'
import type {
  CategoryRevenue,
  DailyRevenue,
  ReportRange,
  RevenueReportRow,
  SalesSummary,
  StockLedgerRow,
  TopProductRow,
} from '../types'

const demo = () => import('./analytics.demo')

/*
 * Báo cáo tổng hợp ở Postgres (migration `inventory_analytics`); client chỉ nhận kết quả đã gộp.
 * Khoảng ngày [from, to] tính theo ngày lịch giờ Việt Nam, kỳ trước = khoảng liền trước cùng độ dài.
 */

/** `p_seller_id`: DB chỉ cho chủ shop (đã duyệt) hoặc admin xem, và chỉ tính trên đúng shop đó. */
const params = (sellerId: string, { from, to }: ReportRange) => ({
  p_from: from,
  p_to: to,
  p_seller_id: sellerId,
})

export async function fetchSalesSummary(
  sellerId: string,
  range: ReportRange,
): Promise<SalesSummary> {
  if (isDemoMode()) return (await demo()).fetchSalesSummary(sellerId, range)
  const { data, error } = await supabase.rpc('get_sales_summary', params(sellerId, range)).single()
  if (error) throw error
  return data
}

export async function fetchRevenueByDay(
  sellerId: string,
  range: ReportRange,
): Promise<DailyRevenue[]> {
  if (isDemoMode()) return (await demo()).fetchRevenueByDay(sellerId, range)
  const { data, error } = await supabase.rpc('get_revenue_by_day', params(sellerId, range))
  if (error) throw error
  return data
}

export async function fetchRevenueByCategory(
  sellerId: string,
  range: ReportRange,
): Promise<CategoryRevenue[]> {
  if (isDemoMode()) return (await demo()).fetchRevenueByCategory(sellerId, range)
  const { data, error } = await supabase.rpc('get_revenue_by_category', params(sellerId, range))
  if (error) throw error
  return data
}

export async function fetchTopProductsByRange(
  sellerId: string,
  range: ReportRange,
  limit: number,
): Promise<TopProductRow[]> {
  if (isDemoMode()) return (await demo()).fetchTopProductsByRange(sellerId, range, limit)
  const { data, error } = await supabase.rpc('get_top_products_by_range', {
    ...params(sellerId, range),
    p_limit: limit,
  })
  if (error) throw error
  return data
}

/** Báo cáo xuất nhập tồn theo sản phẩm (số lượng + giá trị theo giá vốn) trong khoảng ngày. */
export async function fetchStockLedger(
  sellerId: string,
  range: ReportRange,
): Promise<StockLedgerRow[]> {
  if (isDemoMode()) return (await demo()).fetchStockLedger(sellerId, range)
  const { data, error } = await supabase.rpc('get_stock_ledger', params(sellerId, range))
  if (error) throw error
  return data
}

/** Bảng kê doanh thu: từng đơn được ghi nhận doanh thu trong khoảng ngày (cũ → mới). */
export async function fetchRevenueReport(
  sellerId: string,
  range: ReportRange,
): Promise<RevenueReportRow[]> {
  if (isDemoMode()) return (await demo()).fetchRevenueReport(sellerId, range)
  const { data, error } = await supabase.rpc('get_revenue_report', params(sellerId, range))
  if (error) throw error
  return data
}
