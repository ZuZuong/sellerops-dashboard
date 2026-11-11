import { supabase } from '@/shared/lib/supabase'
import type {
  CategoryRevenue,
  DailyRevenue,
  ReportRange,
  SalesSummary,
  StockLedgerRow,
  TopProductRow,
} from '../types'

/*
 * Báo cáo tổng hợp ở Postgres (migration `inventory_analytics`); client chỉ nhận kết quả đã gộp.
 * Khoảng ngày [from, to] tính theo ngày lịch giờ Việt Nam, kỳ trước = khoảng liền trước cùng độ dài.
 */

const params = ({ from, to }: ReportRange) => ({ p_from: from, p_to: to })

export async function fetchSalesSummary(range: ReportRange): Promise<SalesSummary> {
  const { data, error } = await supabase.rpc('get_sales_summary', params(range)).single()
  if (error) throw error
  return data
}

export async function fetchRevenueByDay(range: ReportRange): Promise<DailyRevenue[]> {
  const { data, error } = await supabase.rpc('get_revenue_by_day', params(range))
  if (error) throw error
  return data
}

export async function fetchRevenueByCategory(range: ReportRange): Promise<CategoryRevenue[]> {
  const { data, error } = await supabase.rpc('get_revenue_by_category', params(range))
  if (error) throw error
  return data
}

export async function fetchTopProductsByRange(
  range: ReportRange,
  limit: number,
): Promise<TopProductRow[]> {
  const { data, error } = await supabase.rpc('get_top_products_by_range', {
    ...params(range),
    p_limit: limit,
  })
  if (error) throw error
  return data
}

/** Báo cáo xuất nhập tồn theo sản phẩm (số lượng + giá trị theo giá vốn) trong khoảng ngày. */
export async function fetchStockLedger(range: ReportRange): Promise<StockLedgerRow[]> {
  const { data, error } = await supabase.rpc('get_stock_ledger', params(range))
  if (error) throw error
  return data
}
