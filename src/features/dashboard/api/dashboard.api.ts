import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { supabase } from '@/shared/lib/supabase'
import type { DashboardKpis, RecentOrder, RevenuePoint, TopProduct } from '../types'

const demo = () => import('./dashboard.demo')

/*
 * Số liệu tổng hợp được tính bằng Postgres function, client chỉ nhận kết quả đã gộp.
 * Mọi hàm nhận `p_seller_id`: DB kiểm tra người gọi là chủ shop (đã duyệt) hoặc admin rồi chỉ
 * tính trên đúng shop đó (`resolve_report_seller`).
 */

export async function fetchDashboardKpis(sellerId: string, days: number): Promise<DashboardKpis> {
  if (isDemoMode()) return (await demo()).fetchDashboardKpis(sellerId, days)
  const { data, error } = await supabase
    .rpc('get_dashboard_kpis', { p_days: days, p_seller_id: sellerId })
    .single()
  if (error) throw error
  return data
}

export async function fetchRevenueSeries(sellerId: string, days: number): Promise<RevenuePoint[]> {
  if (isDemoMode()) return (await demo()).fetchRevenueSeries(sellerId, days)
  const { data, error } = await supabase.rpc('get_revenue_series', {
    p_days: days,
    p_seller_id: sellerId,
  })
  if (error) throw error
  return data
}

export async function fetchTopProducts(
  sellerId: string,
  days: number,
  limit: number,
): Promise<TopProduct[]> {
  if (isDemoMode()) return (await demo()).fetchTopProducts(sellerId, days, limit)
  const { data, error } = await supabase.rpc('get_top_products', {
    p_days: days,
    p_limit: limit,
    p_seller_id: sellerId,
  })
  if (error) throw error
  return data
}

export async function fetchRecentOrders(sellerId: string, limit: number): Promise<RecentOrder[]> {
  if (isDemoMode()) return (await demo()).fetchRecentOrders(sellerId, limit)
  const { data, error } = await supabase
    .from('orders')
    .select('id, code, customer_name, status, total, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
