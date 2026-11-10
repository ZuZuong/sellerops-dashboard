import { getDbErrorInfo } from '@/shared/lib/errors'
import { supabase } from '@/shared/lib/supabase'
import { toSearchTerm } from '../lib/search'
import type { ProductFormValues } from '../schemas/product.schema'
import type { ProductFilters } from '../schemas/productFilters.schema'
import type { Product, ProductPage } from '../types'

const PRODUCT_COLUMNS =
  'id, sku, name, category, price, stock, low_stock_threshold, is_low_stock, is_active, created_at'

/** PostgREST trả lỗi này khi offset vượt quá tổng số dòng (vd. trang cũ sau khi xóa / lọc). */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

function buildListQuery(filters: ProductFilters, head = false) {
  let query = supabase.from('products').select(PRODUCT_COLUMNS, { count: 'exact', head })

  const term = toSearchTerm(filters.q)
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.status !== 'all') query = query.eq('is_active', filters.status === 'active')
  if (filters.stock === 'low') query = query.eq('is_low_stock', true)
  if (filters.stock === 'out') query = query.eq('stock', 0)

  return query
}

/** Danh sách sản phẩm có phân trang, lọc và sắp xếp phía server. */
export async function fetchProducts(filters: ProductFilters): Promise<ProductPage> {
  const from = (filters.page - 1) * filters.pageSize
  const { data, error, count } = await buildListQuery(filters)
    .order(filters.sort, { ascending: filters.order === 'asc' })
    // Khóa phụ để thứ tự ổn định giữa các trang khi giá trị sắp xếp trùng nhau.
    .order('id', { ascending: true })
    .range(from, from + filters.pageSize - 1)

  if (error) {
    if (getDbErrorInfo(error).code !== RANGE_NOT_SATISFIABLE) throw error
    // Trang vượt quá dữ liệu: trả về tổng để UI tự lùi về trang cuối.
    const head = await buildListQuery(filters, true)
    if (head.error) throw head.error
    return { items: [], total: head.count ?? 0 }
  }

  return { items: data, total: count ?? data.length }
}

export async function fetchProductCategories(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_product_categories')
  if (error) throw error
  return data
}

export async function createProduct(values: ProductFormValues): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(values)
    .select(PRODUCT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** Cập nhật thông tin sản phẩm. Tồn kho không sửa ở đây — chỉ đi qua `adjust_stock` để có lịch sử. */
export async function updateProduct(id: string, values: ProductFormValues): Promise<Product> {
  // Liệt kê tường minh đúng các cột được GRANT UPDATE (xem migration init_schema).
  const { sku, name, category, price, low_stock_threshold, is_active } = values
  const { data, error } = await supabase
    .from('products')
    .update({ sku, name, category, price, low_stock_threshold, is_active })
    .eq('id', id)
    .select(PRODUCT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function updateProductPrice(id: string, price: number): Promise<void> {
  const { error } = await supabase.from('products').update({ price }).eq('id', id)
  if (error) throw error
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** Điều chỉnh kho qua RPC (atomic, ghi `inventory_movements`). Trả về tồn kho mới. */
export async function adjustProductStock(id: string, delta: number, note: string): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: id,
    p_delta: delta,
    p_note: note,
  })
  if (error) throw error
  return data
}

/** Xóa cứng qua RPC; DB từ chối (PRODUCT_IN_ORDERS) nếu sản phẩm đã có trong đơn. */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_product', { p_product_id: id })
  if (error) throw error
}
