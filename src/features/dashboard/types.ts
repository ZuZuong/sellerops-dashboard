import type { Database, Tables } from '@/shared/types/database.types'

type RpcRow<Name extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][Name]['Returns'] extends ReadonlyArray<infer Row> ? Row : never

export type DashboardKpis = RpcRow<'get_dashboard_kpis'>
export type RevenuePoint = RpcRow<'get_revenue_series'>
export type TopProduct = RpcRow<'get_top_products'>
export type RecentOrder = Pick<
  Tables<'orders'>,
  'id' | 'code' | 'customer_name' | 'status' | 'total' | 'created_at'
>
