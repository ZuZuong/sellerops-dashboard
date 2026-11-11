import { getDbErrorInfo } from '@/shared/lib/errors'
import { supabase } from '@/shared/lib/supabase'
import { mediaPaths, type ProductMedia } from '../lib/productImages'
import { toSearchTerm } from '@/shared/lib/search'
import type { ImportedProduct, ProductFormValues } from '../schemas/product.schema'
import type { ProductFilters } from '../schemas/productFilters.schema'
import type { Product, ProductPage } from '../types'
import { removeProductImages, uploadProductMedia } from './productImages.api'

const PRODUCT_COLUMNS =
  'id, sku, name, category, price, stock, low_stock_threshold, is_low_stock, is_active, description, hero_image_path, image_paths, created_at'

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

/**
 * Tạo sản phẩm: tải ảnh mới lên Storage rồi mới insert. Insert lỗi → xóa ảnh vừa tải để không
 * để lại file rác. SKU do trigger DB tự sinh (DN-TENSANPHAM-STT) và trả về trong kết quả.
 */
export async function createProduct(
  values: ProductFormValues,
  media: ProductMedia,
): Promise<Product> {
  const { uploaded, ...paths } = await uploadProductMedia(media)
  const { data, error } = await supabase
    .from('products')
    .insert({ ...values, ...paths })
    .select(PRODUCT_COLUMNS)
    .single()
  if (error) {
    await removeProductImages(uploaded)
    throw error
  }
  return data
}

/**
 * Cập nhật thông tin + ảnh. Tồn kho không sửa ở đây — chỉ đi qua `adjust_stock` để có lịch sử.
 * Ảnh bị gỡ chỉ bị xóa khỏi Storage SAU khi lưu thành công.
 */
export async function updateProduct(
  product: Product,
  values: ProductFormValues,
  media: ProductMedia,
): Promise<Product> {
  const { uploaded, ...paths } = await uploadProductMedia(media)
  // Liệt kê tường minh đúng các cột được GRANT UPDATE; SKU cố định sau khi tạo.
  const { name, category, price, low_stock_threshold, is_active, description } = values
  const { data, error } = await supabase
    .from('products')
    .update({ name, category, price, low_stock_threshold, is_active, description, ...paths })
    .eq('id', product.id)
    .select(PRODUCT_COLUMNS)
    .single()
  if (error) {
    await removeProductImages(uploaded)
    throw error
  }

  const kept = new Set(mediaPaths(media))
  await removeProductImages(productImagePaths(product).filter((path) => !kept.has(path)))
  return data
}

/** Mọi đường dẫn ảnh đang gắn với sản phẩm. */
export function productImagePaths(product: Pick<Product, 'hero_image_path' | 'image_paths'>) {
  return [product.hero_image_path, ...product.image_paths].filter(
    (path): path is string => path !== null,
  )
}

/**
 * Nhập nhiều sản phẩm trong MỘT câu insert → một transaction: lỗi một dòng thì không dòng nào
 * được lưu. Mỗi dòng vẫn được trigger cấp SKU riêng.
 */
export async function createProducts(
  products: readonly ImportedProduct[],
  isActive: boolean,
): Promise<number> {
  // Chọn tường minh các cột được phép ghi (dữ liệu nhập có thể kèm field phụ như số dòng).
  const rows = products.map(
    ({ name, category, price, stock, low_stock_threshold, description }) => ({
      name,
      category,
      price,
      stock,
      low_stock_threshold,
      description,
      is_active: isActive,
    }),
  )
  const { data, error } = await supabase.from('products').insert(rows).select('id')
  if (error) throw error
  return data.length
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

/** Xóa cứng qua RPC; DB từ chối (PRODUCT_IN_ORDERS) nếu sản phẩm đã có trong đơn. Xóa xong dọn ảnh. */
export async function deleteProduct(product: Product): Promise<void> {
  const { error } = await supabase.rpc('delete_product', { p_product_id: product.id })
  if (error) throw error
  await removeProductImages(productImagePaths(product))
}
