import { getDbErrorInfo } from '@/shared/lib/errors'
import { toSearchTerm } from '@/shared/lib/search'
import { supabase } from '@/shared/lib/supabase'
import type { InventoryFilters } from '../schemas/inventoryFilters.schema'
import type { InventoryItem, InventoryPage, InventorySummary, MovementPage } from '../types'

const INVENTORY_COLUMNS =
  'id, sku, name, category, price, stock, low_stock_threshold, is_low_stock, is_active'

/** PostgREST trả lỗi này khi offset vượt quá tổng số dòng. */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Giới hạn số dòng khi xuất CSV (đủ cho shop nhỏ/vừa, tránh kéo bảng quá lớn về trình duyệt). */
export const EXPORT_LIMIT = 5000

function buildListQuery(filters: InventoryFilters, head = false) {
  let query = supabase.from('products').select(INVENTORY_COLUMNS, { count: 'exact', head })

  const term = toSearchTerm(filters.q)
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if (filters.status === 'active') query = query.eq('is_active', true)
  if (filters.level === 'out') query = query.eq('stock', 0)
  if (filters.level === 'low') query = query.eq('is_low_stock', true).gt('stock', 0)
  if (filters.level === 'ok') query = query.eq('is_low_stock', false)

  return query
}

function ordered(filters: InventoryFilters, head = false) {
  return (
    buildListQuery(filters, head)
      .order(filters.sort, { ascending: filters.order === 'asc' })
      // Khóa phụ để thứ tự ổn định giữa các trang khi giá trị sắp xếp trùng nhau.
      .order('id', { ascending: true })
  )
}

/** Danh sách tồn kho có phân trang / lọc / sắp xếp phía server. */
export async function fetchInventory(filters: InventoryFilters): Promise<InventoryPage> {
  const from = (filters.page - 1) * filters.pageSize
  const { data, error, count } = await ordered(filters).range(from, from + filters.pageSize - 1)

  if (error) {
    if (getDbErrorInfo(error).code !== RANGE_NOT_SATISFIABLE) throw error
    const head = await buildListQuery(filters, true)
    if (head.error) throw head.error
    return { items: [], total: head.count ?? 0 }
  }

  return { items: data, total: count ?? data.length }
}

/** Toàn bộ dòng khớp bộ lọc hiện tại (bỏ phân trang) để xuất CSV. */
export async function fetchInventoryForExport(filters: InventoryFilters): Promise<InventoryItem[]> {
  const { data, error } = await ordered(filters).range(0, EXPORT_LIMIT - 1)
  if (error) throw error
  return data
}

/** Số liệu tổng quan kho (sản phẩm đang bán), tính ở Postgres. */
export async function fetchInventorySummary(): Promise<InventorySummary> {
  const { data, error } = await supabase.rpc('get_inventory_summary').single()
  if (error) throw error
  return data
}

/** Lịch sử biến động kho của một sản phẩm, mới nhất trước. */
export async function fetchStockMovements(
  productId: string,
  page: number,
  pageSize: number,
): Promise<MovementPage> {
  const from = (page - 1) * pageSize
  const { data, error, count } = await supabase
    .from('inventory_movements')
    .select('id, delta, reason, note, created_at, order:orders(id, code)', { count: 'exact' })
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
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: productId,
    p_delta: delta,
    p_note: note,
  })
  if (error) throw error
  return data
}
