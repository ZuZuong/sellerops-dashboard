import type { Database } from '@/shared/types/database.types'

type RpcRow<Name extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][Name]['Returns'] extends ReadonlyArray<infer Row> ? Row : never

export type SalesSummary = RpcRow<'get_sales_summary'>
export type DailyRevenue = RpcRow<'get_revenue_by_day'>
export type TopProductRow = RpcRow<'get_top_products_by_range'>
export type StockLedgerRow = RpcRow<'get_stock_ledger'>

export interface CategoryRevenue {
  /** null = sản phẩm chưa gán danh mục. */
  category: string | null
  revenue: number
  gross_profit: number
  quantity: number
}

export interface ReportRange {
  from: string
  to: string
}
