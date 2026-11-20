import {
  SALE_STATUSES,
  dashboardRangeStart,
  dateKeyOf,
  dateKeysBetween,
  readDemoDb,
  resolveReportSeller,
  time,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import type { DashboardKpis, RecentOrder, RevenuePoint, TopProduct } from '../types'

/* Backend giả lập (chế độ demo — ADR 011): cùng công thức với get_dashboard_kpis / series / top. */

const DAY_MS = 86_400_000

const orderCogs = (db: DemoDb, orderId: string) =>
  db.order_items
    .filter((i) => i.order_id === orderId)
    .reduce((sum, i) => sum + i.quantity * (i.unit_cost ?? 0), 0)

export async function fetchDashboardKpis(sellerId: string, days: number): Promise<DashboardKpis> {
  const db = await readDemoDb()
  const shop = resolveReportSeller(db, sellerId)
  const curStart = dashboardRangeStart(days)
  const prevStart = curStart - days * DAY_MS
  const orders = db.orders.filter((o) => o.seller_id === shop && time(o.created_at) >= prevStart)

  const kpis: DashboardKpis = {
    revenue: 0,
    prev_revenue: 0,
    gross_profit: 0,
    prev_gross_profit: 0,
    order_count: 0,
    prev_order_count: 0,
    pending_count: db.orders.filter((o) => o.seller_id === shop && o.status === 'pending').length,
    low_stock_count: db.products.filter(
      (p) => p.seller_id === shop && p.is_active && p.stock <= p.low_stock_threshold,
    ).length,
  }
  for (const order of orders) {
    const current = time(order.created_at) >= curStart
    if (order.status !== 'cancelled') {
      if (current) kpis.order_count += 1
      else kpis.prev_order_count += 1
    }
    if (!SALE_STATUSES.has(order.status)) continue
    const profit = order.total - orderCogs(db, order.id)
    if (current) {
      kpis.revenue += order.total
      kpis.gross_profit += profit
    } else {
      kpis.prev_revenue += order.total
      kpis.prev_gross_profit += profit
    }
  }
  return kpis
}

export async function fetchRevenueSeries(sellerId: string, days: number): Promise<RevenuePoint[]> {
  const db = await readDemoDb()
  const shop = resolveReportSeller(db, sellerId)
  const start = dashboardRangeStart(days)
  const byDay = new Map<string, RevenuePoint>(
    dateKeysBetween(start, Date.now()).map((day) => [day, { day, revenue: 0, order_count: 0 }]),
  )
  for (const order of db.orders) {
    if (order.seller_id !== shop || !SALE_STATUSES.has(order.status)) continue
    if (time(order.created_at) < start) continue
    const point = byDay.get(dateKeyOf(order.created_at))
    if (!point) continue
    point.revenue += order.total
    point.order_count += 1
  }
  return [...byDay.values()]
}

export async function fetchTopProducts(
  sellerId: string,
  days: number,
  limit: number,
): Promise<TopProduct[]> {
  const db = await readDemoDb()
  const shop = resolveReportSeller(db, sellerId)
  const start = dashboardRangeStart(days)
  const orders = new Set(
    db.orders
      .filter(
        (o) => o.seller_id === shop && SALE_STATUSES.has(o.status) && time(o.created_at) >= start,
      )
      .map((o) => o.id),
  )
  const totals = new Map<string, TopProduct>()
  for (const item of db.order_items) {
    if (!orders.has(item.order_id)) continue
    const product = db.products.find((p) => p.id === item.product_id)
    if (!product) continue
    const row = totals.get(product.id) ?? {
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      quantity_sold: 0,
      revenue: 0,
    }
    row.quantity_sold += item.quantity
    row.revenue += item.quantity * item.unit_price
    totals.set(product.id, row)
  }
  return [...totals.values()]
    .sort(
      (a, b) =>
        b.quantity_sold - a.quantity_sold ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name, 'vi'),
    )
    .slice(0, Math.min(Math.max(limit, 1), 20))
}

export async function fetchRecentOrders(sellerId: string, limit: number): Promise<RecentOrder[]> {
  const db = await readDemoDb()
  return db.orders
    .filter((o) => o.seller_id === sellerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
}
