import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { getDbErrorInfo } from '@/shared/lib/errors'
import { toSearchTerm } from '@/shared/lib/search'
import { supabase } from '@/shared/lib/supabase'
import type { InventoryFilters } from '../schemas/inventoryFilters.schema'
import type { StocktakeScope } from '../schemas/stocktakeScope.schema'
import type { InventoryItem, InventoryPage, InventorySummary, MovementPage } from '../types'

const demo = () => import('./inventory.demo')

const INVENTORY_COLUMNS =
  'id, sku, name, category:categories!products_category_same_seller_fkey(name), unit, price, cost_price, stock, low_stock_threshold, is_low_stock, is_active'

type InventoryRow = Omit<InventoryItem, 'category'> & { category: { name: string } | null }

const toItem = (row: InventoryRow): InventoryItem => ({
  ...row,
  category: row.category?.name ?? null,
})

/** PostgREST trả lỗi này khi offset vượt quá tổng số dòng. */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Giới hạn số dòng khi xuất CSV (đủ cho shop nhỏ/vừa, tránh kéo bảng quá lớn về trình duyệt). */
export const EXPORT_LIMIT = 5000

/** Lọc tường minh theo shop (admin đọc được mọi shop, không chỉ dựa vào RLS). */
function buildListQuery(sellerId: string, filters: InventoryFilters, head = false) {
  let query = supabase
    .from('products')
    .select(INVENTORY_COLUMNS, { count: 'exact', head })
    .eq('seller_id', sellerId)

  const term = toSearchTerm(filters.q)
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if (filters.status === 'active') query = query.eq('is_active', true)
  if (filters.level === 'out') query = query.eq('stock', 0)
  if (filters.level === 'low') query = query.eq('is_low_stock', true).gt('stock', 0)
  if (filters.level === 'ok') query = query.eq('is_low_stock', false)

  return query
}

function ordered(sellerId: string, filters: InventoryFilters, head = false) {
  return (
    buildListQuery(sellerId, filters, head)
      .order(filters.sort, { ascending: filters.order === 'asc' })
      // Khóa phụ để thứ tự ổn định giữa các trang khi giá trị sắp xếp trùng nhau.
      .order('id', { ascending: true })
  )
}

/** Danh sách tồn kho có phân trang / lọc / sắp xếp phía server. */
export async function fetchInventory(
  sellerId: string,
  filters: InventoryFilters,
): Promise<InventoryPage> {
  if (isDemoMode()) return (await demo()).fetchInventory(sellerId, filters)
  const from = (filters.page - 1) * filters.pageSize
  const { data, error, count } = await ordered(sellerId, filters).range(
    from,
    from + filters.pageSize - 1,
  )

  if (error) {
    if (getDbErrorInfo(error).code !== RANGE_NOT_SATISFIABLE) throw error
    const head = await buildListQuery(sellerId, filters, true)
    if (head.error) throw head.error
    return { items: [], total: head.count ?? 0 }
  }

  return { items: data.map(toItem), total: count ?? data.length }
}

/** Toàn bộ dòng khớp bộ lọc hiện tại (bỏ phân trang) để xuất CSV. */
export async function fetchInventoryForExport(
  sellerId: string,
  filters: InventoryFilters,
): Promise<InventoryItem[]> {
  if (isDemoMode()) return (await demo()).fetchInventoryForExport(sellerId, filters)
  const { data, error } = await ordered(sellerId, filters).range(0, EXPORT_LIMIT - 1)
  if (error) throw error
  return data.map(toItem)
}

/**
 * Sản phẩm đưa vào biên bản kiểm kê (gồm cả sản phẩm tồn 0 — thực tế vẫn có thể còn hàng trên kệ).
 * Giới hạn như xuất CSV; `truncated` báo khi còn sản phẩm chưa lấy hết.
 */
export async function fetchStocktakeItems(
  sellerId: string,
  scope: StocktakeScope,
): Promise<{ items: InventoryItem[]; truncated: boolean }> {
  if (isDemoMode()) return (await demo()).fetchStocktakeItems(sellerId, scope)
  let query = supabase
    .from('products')
    .select(INVENTORY_COLUMNS, { count: 'exact' })
    .eq('seller_id', sellerId)
  if (scope.status === 'active') query = query.eq('is_active', true)
  if (scope.category) query = query.eq('category_id', scope.category)
  const { data, error, count } = await query
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(0, EXPORT_LIMIT - 1)
  if (error) throw error
  return { items: data.map(toItem), truncated: (count ?? data.length) > data.length }
}

/** Số liệu tổng quan kho (sản phẩm đang bán), tính ở Postgres. */
export async function fetchInventorySummary(sellerId: string): Promise<InventorySummary> {
  if (isDemoMode()) return (await demo()).fetchInventorySummary(sellerId)
  const { data, error } = await supabase
    .rpc('get_inventory_summary', { p_seller_id: sellerId })
    .single()
  if (error) throw error
  return data
}

/** Lịch sử biến động kho của một sản phẩm, mới nhất trước. */
export async function fetchStockMovements(
  sellerId: string,
  productId: string,
  page: number,
  pageSize: number,
): Promise<MovementPage> {
  if (isDemoMode()) return (await demo()).fetchStockMovements(sellerId, productId, page, pageSize)
  const from = (page - 1) * pageSize
  const { data, error, count } = await supabase
    .from('inventory_movements')
    .select(
      'id, delta, reason, note, created_at, unit_cost, order:orders(id, code), receipt:purchase_receipts(id, code)',
      { count: 'exact' },
    )
    .eq('seller_id', sellerId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { items: data, total: count ?? data.length }
}

/**
 * Điều chỉnh kho qua RPC `adjust_stock`: cập nhật tồn kho + ghi `inventory_movements` trong một
 * transaction, DB chặn tồn kho âm. Trả về tồn kho mới.
 */
export async function adjustStock(productId: string, delta: number, note: string): Promise<number> {
  if (isDemoMode()) return (await demo()).adjustStock(productId, delta, note)
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: productId,
    p_delta: delta,
    p_note: note,
  })
  if (error) throw error
  return data
}
