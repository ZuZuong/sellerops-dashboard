import {
  SALE_STATUSES,
  dateKeyOf,
  readDemoDb,
  reportBounds,
  resolveReportSeller,
  round,
  startOfDateKey,
  time,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import type { Tables } from '@/shared/types/database.types'
import type {
  CategoryRevenue,
  DailyRevenue,
  ReportRange,
  RevenueReportRow,
  SalesSummary,
  StockLedgerRow,
  TopProductRow,
} from '../types'

/*
 * Backend giả lập (chế độ demo — ADR 011) cho các báo cáo; cùng công thức với get_sales_summary,
 * get_revenue_by_day / by_category, get_top_products_by_range, get_stock_ledger, get_revenue_report.
 */

type Order = Tables<'orders'>

function context(db: DemoDb, sellerId: string, range: ReportRange) {
  const shop = resolveReportSeller(db, sellerId)
  const bounds = reportBounds(range.from, range.to)
  const inRange = (iso: string) => time(iso) >= bounds.start && time(iso) < bounds.end
  const sales = db.orders.filter(
    (o) => o.seller_id === shop && SALE_STATUSES.has(o.status) && inRange(o.created_at),
  )
  return { shop, bounds, inRange, sales }
}

const itemsOf = (db: DemoDb, orders: readonly Order[]) => {
  const ids = new Set(orders.map((o) => o.id))
  return db.order_items.filter((i) => ids.has(i.order_id))
}

const cogsOf = (items: ReadonlyArray<Tables<'order_items'>>) =>
  items.reduce((sum, i) => sum + i.quantity * (i.unit_cost ?? 0), 0)

const qtyOf = (items: ReadonlyArray<Tables<'order_items'>>) =>
  items.reduce((sum, i) => sum + i.quantity, 0)

export async function fetchSalesSummary(
  sellerId: string,
  range: ReportRange,
): Promise<SalesSummary> {
  const db = await readDemoDb()
  const { shop, bounds } = context(db, sellerId, range)
  const orders = db.orders.filter(
    (o) =>
      o.seller_id === shop &&
      time(o.created_at) >= bounds.prevStart &&
      time(o.created_at) < bounds.end,
  )
  const current = orders.filter((o) => time(o.created_at) >= bounds.start)
  const previous = orders.filter((o) => time(o.created_at) < bounds.start)
  const sale = (list: Order[]) => list.filter((o) => SALE_STATUSES.has(o.status))
  const cancelled = (list: Order[]) => list.filter((o) => o.status === 'cancelled').length

  const posted = new Set(
    db.purchase_receipts
      .filter(
        (r) =>
          r.seller_id === shop &&
          r.status === 'posted' &&
          r.posted_at !== null &&
          time(r.posted_at) >= bounds.start &&
          time(r.posted_at) < bounds.end,
      )
      .map((r) => r.id),
  )
  const purchased = db.purchase_receipt_items.filter((i) => posted.has(i.receipt_id))

  const curItems = itemsOf(db, sale(current))
  const prevItems = itemsOf(db, sale(previous))
  return {
    revenue: sale(current).reduce((sum, o) => sum + o.total, 0),
    cogs: round(cogsOf(curItems)),
    order_count: sale(current).length,
    items_sold: qtyOf(curItems),
    cancelled_count: cancelled(current),
    purchase_value: round(purchased.reduce((sum, i) => sum + i.received_qty * i.unit_cost, 0)),
    purchase_qty: purchased.reduce((sum, i) => sum + i.received_qty, 0),
    prev_revenue: sale(previous).reduce((sum, o) => sum + o.total, 0),
    prev_cogs: round(cogsOf(prevItems)),
    prev_order_count: sale(previous).length,
    prev_items_sold: qtyOf(prevItems),
    prev_cancelled_count: cancelled(previous),
  }
}

export async function fetchRevenueByDay(
  sellerId: string,
  range: ReportRange,
): Promise<DailyRevenue[]> {
  const db = await readDemoDb()
  const { sales } = context(db, sellerId, range)
  const days = new Map<string, { revenue: number; cogs: number; order_count: number }>()
  for (let t = startOfDateKey(range.from); t <= startOfDateKey(range.to); t += 86_400_000) {
    days.set(dateKeyOf(t), { revenue: 0, cogs: 0, order_count: 0 })
  }
  for (const order of sales) {
    const day = days.get(dateKeyOf(order.created_at))
    if (!day) continue
    day.revenue += order.total
    day.cogs += cogsOf(itemsOf(db, [order]))
    day.order_count += 1
  }
  return [...days].map(([day, d]) => ({
    day,
    revenue: d.revenue,
    cogs: round(d.cogs),
    gross_profit: round(d.revenue - d.cogs),
    order_count: d.order_count,
  }))
}

export async function fetchRevenueByCategory(
  sellerId: string,
  range: ReportRange,
): Promise<CategoryRevenue[]> {
  const db = await readDemoDb()
  const { sales } = context(db, sellerId, range)
  const groups = new Map<string | null, { revenue: number; profit: number; quantity: number }>()
  for (const item of itemsOf(db, sales)) {
    const product = db.products.find((p) => p.id === item.product_id)
    const name = db.categories.find((c) => c.id === product?.category_id)?.name ?? null
    const group = groups.get(name) ?? { revenue: 0, profit: 0, quantity: 0 }
    group.revenue += item.quantity * item.unit_price
    group.profit += item.quantity * (item.unit_price - (item.unit_cost ?? 0))
    group.quantity += item.quantity
    groups.set(name, group)
  }
  return [...groups]
    .map(([category, g]) => ({
      category,
      revenue: g.revenue,
      gross_profit: round(g.profit),
      quantity: g.quantity,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export async function fetchTopProductsByRange(
  sellerId: string,
  range: ReportRange,
  limit: number,
): Promise<TopProductRow[]> {
  const db = await readDemoDb()
  const { sales } = context(db, sellerId, range)
  const rows = new Map<string, TopProductRow & { profit: number }>()
  for (const item of itemsOf(db, sales)) {
    const product = db.products.find((p) => p.id === item.product_id)
    if (!product) continue
    const row = rows.get(product.id) ?? {
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      quantity_sold: 0,
      revenue: 0,
      gross_profit: 0,
      profit: 0,
    }
    row.quantity_sold += item.quantity
    row.revenue += item.quantity * item.unit_price
    row.profit += item.quantity * (item.unit_price - (item.unit_cost ?? 0))
    rows.set(product.id, row)
  }
  return [...rows.values()]
    .map(({ profit, ...row }) => ({ ...row, gross_profit: round(profit) }))
    .sort(
      (a, b) =>
        b.quantity_sold - a.quantity_sold ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name, 'vi'),
    )
    .slice(0, Math.min(Math.max(limit, 1), 50))
}

export async function fetchStockLedger(
  sellerId: string,
  range: ReportRange,
): Promise<StockLedgerRow[]> {
  const db = await readDemoDb()
  const { shop, bounds } = context(db, sellerId, range)
  const agg = new Map<
    string,
    { oq: number; ov: number; iq: number; iv: number; xq: number; xv: number }
  >()
  for (const m of db.inventory_movements) {
    if (m.seller_id !== shop || time(m.created_at) >= bounds.end) continue
    const a = agg.get(m.product_id) ?? { oq: 0, ov: 0, iq: 0, iv: 0, xq: 0, xv: 0 }
    const value = m.delta * (m.unit_cost ?? 0)
    if (time(m.created_at) < bounds.start) {
      a.oq += m.delta
      a.ov += value
    } else if (m.delta > 0) {
      a.iq += m.delta
      a.iv += value
    } else {
      a.xq -= m.delta
      a.xv -= value
    }
    agg.set(m.product_id, a)
  }
  const rows: StockLedgerRow[] = []
  for (const [productId, a] of agg) {
    const product = db.products.find((p) => p.id === productId)
    if (!product || (a.oq === 0 && a.iq === 0 && a.xq === 0)) continue
    rows.push({
      product_id: productId,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      opening_qty: a.oq,
      opening_value: round(a.ov),
      in_qty: a.iq,
      in_value: round(a.iv),
      out_qty: a.xq,
      out_value: round(a.xv),
      closing_qty: a.oq + a.iq - a.xq,
      closing_value: round(a.ov + a.iv - a.xv),
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

export async function fetchRevenueReport(
  sellerId: string,
  range: ReportRange,
): Promise<RevenueReportRow[]> {
  const db = await readDemoDb()
  const { sales } = context(db, sellerId, range)
  return [...sales]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.code.localeCompare(b.code))
    .map((order) => {
      const items = itemsOf(db, [order])
      return {
        order_id: order.id,
        code: order.code,
        created_at: order.created_at,
        customer_name: order.customer_name,
        payment_method: order.payment_method,
        status: order.status,
        quantity: qtyOf(items),
        revenue: order.total,
        cogs: round(cogsOf(items)),
      }
    })
}
