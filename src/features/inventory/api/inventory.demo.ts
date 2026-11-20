import {
  DemoDbError,
  matchesTerm,
  newId,
  nowIso,
  paginate,
  readDemoDb,
  requireApprovedSeller,
  resolveReportSeller,
  round,
  sortRows,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import { toSearchTerm } from '@/shared/lib/search'
import type { Tables } from '@/shared/types/database.types'
import type { InventoryFilters } from '../schemas/inventoryFilters.schema'
import type { StocktakeScope } from '../schemas/stocktakeScope.schema'
import type { InventoryItem, InventoryPage, InventorySummary, MovementPage } from '../types'
import { EXPORT_LIMIT } from './inventory.api'

/* Backend giả lập (chế độ demo — ADR 011) cho inventory.api; `adjust_stock` như RPC thật. */

const toItem = (db: DemoDb, p: Tables<'products'>): InventoryItem => ({
  ...p,
  category: db.categories.find((c) => c.id === p.category_id)?.name ?? null,
})

function filtered(db: DemoDb, sellerId: string, filters: InventoryFilters) {
  const term = toSearchTerm(filters.q)
  const rows = db.products.filter(
    (p) =>
      p.seller_id === sellerId &&
      matchesTerm(term, p.name, p.sku) &&
      (filters.status !== 'active' || p.is_active) &&
      (filters.level !== 'out' || p.stock === 0) &&
      (filters.level !== 'low' || (p.stock <= p.low_stock_threshold && p.stock > 0)) &&
      (filters.level !== 'ok' || p.stock > p.low_stock_threshold),
  )
  return sortRows(rows, (p) => p[filters.sort], filters.order === 'asc')
}

export async function fetchInventory(
  sellerId: string,
  filters: InventoryFilters,
): Promise<InventoryPage> {
  const db = await readDemoDb()
  const { items, total } = paginate(filtered(db, sellerId, filters), filters.page, filters.pageSize)
  return { items: items.map((p) => toItem(db, p)), total }
}

export async function fetchInventoryForExport(
  sellerId: string,
  filters: InventoryFilters,
): Promise<InventoryItem[]> {
  const db = await readDemoDb()
  return filtered(db, sellerId, filters)
    .slice(0, EXPORT_LIMIT)
    .map((p) => toItem(db, p))
}

export async function fetchStocktakeItems(
  sellerId: string,
  scope: StocktakeScope,
): Promise<{ items: InventoryItem[]; truncated: boolean }> {
  const db = await readDemoDb()
  const rows = sortRows(
    db.products.filter(
      (p) =>
        p.seller_id === sellerId &&
        (scope.status !== 'active' || p.is_active) &&
        (!scope.category || p.category_id === scope.category),
    ),
    (p) => p.name,
    true,
  )
  return {
    items: rows.slice(0, EXPORT_LIMIT).map((p) => toItem(db, p)),
    truncated: rows.length > EXPORT_LIMIT,
  }
}

export async function fetchInventorySummary(sellerId: string): Promise<InventorySummary> {
  const db = await readDemoDb()
  const shop = resolveReportSeller(db, sellerId)
  const active = db.products.filter((p) => p.seller_id === shop && p.is_active)
  return {
    product_count: active.length,
    low_stock_count: active.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length,
    out_of_stock_count: active.filter((p) => p.stock === 0).length,
    total_units: active.reduce((sum, p) => sum + p.stock, 0),
    stock_value: round(active.reduce((sum, p) => sum + p.stock * p.cost_price, 0)),
    retail_value: active.reduce((sum, p) => sum + p.stock * p.price, 0),
  }
}

export async function fetchStockMovements(
  sellerId: string,
  productId: string,
  page: number,
  pageSize: number,
): Promise<MovementPage> {
  const db = await readDemoDb()
  const rows = sortRows(
    db.inventory_movements.filter((m) => m.seller_id === sellerId && m.product_id === productId),
    (m) => m.created_at,
    false,
  )
  const { items, total } = paginate(rows, page, pageSize)
  return {
    total,
    items: items.map((m) => {
      const order = db.orders.find((o) => o.id === m.order_id)
      const receipt = db.purchase_receipts.find((r) => r.id === m.receipt_id)
      return {
        id: m.id,
        delta: m.delta,
        reason: m.reason,
        note: m.note,
        created_at: m.created_at,
        unit_cost: m.unit_cost,
        order: order ? { id: order.id, code: order.code } : null,
        receipt: receipt ? { id: receipt.id, code: receipt.code } : null,
      }
    }),
  }
}

export async function adjustStock(productId: string, delta: number, note: string): Promise<number> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    if (delta === 0) throw new DemoDbError('INVALID_DELTA')
    const product = db.products.find((p) => p.id === productId && p.seller_id === sellerId)
    if (!product) throw new DemoDbError('PRODUCT_NOT_FOUND')
    if (product.stock + delta < 0) throw new DemoDbError('INSUFFICIENT_STOCK', productId)
    product.stock += delta
    db.inventory_movements.push({
      id: newId(),
      seller_id: sellerId,
      product_id: productId,
      delta,
      reason: 'manual_adjust',
      note: note || null,
      order_id: null,
      receipt_id: null,
      unit_cost: product.cost_price,
      created_at: nowIso(),
    })
    return product.stock
  })
}
