import { supabase } from '@/shared/lib/supabase'
import type { DashboardKpis, RecentOrder, RevenuePoint, TopProduct } from '../types'

/*
 * Số liệu tổng hợp được tính bằng Postgres function (migration `dashboard_rpcs`),
 * client chỉ nhận kết quả đã gộp. RLS vẫn áp dụng vì các function là SECURITY INVOKER.
 */

export async function fetchDashboardKpis(days: number): Promise<DashboardKpis> {
  const { data, error } = await supabase.rpc('get_dashboard_kpis', { p_days: days }).single()
  if (error) throw error
  return data
}

export async function fetchRevenueSeries(days: number): Promise<RevenuePoint[]> {
  const { data, error } = await supabase.rpc('get_revenue_series', { p_days: days })
  if (error) throw error
  return data
}

export async function fetchTopProducts(days: number, limit: number): Promise<TopProduct[]> {
  const { data, error } = await supabase.rpc('get_top_products', { p_days: days, p_limit: limit })
  if (error) throw error
  return data
}

export async function fetchRecentOrders(limit: number): Promise<RecentOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, code, customer_name, status, total, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
