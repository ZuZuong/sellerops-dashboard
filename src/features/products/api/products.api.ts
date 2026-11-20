import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { getDbErrorInfo } from '@/shared/lib/errors'
import { supabase } from '@/shared/lib/supabase'
import { mediaPaths, type ProductMedia } from '../lib/productImages'
import { toSearchTerm } from '@/shared/lib/search'
import type { ProductFormValues } from '../schemas/product.schema'
import type { ProductFilters } from '../schemas/productFilters.schema'
import type { Product, ProductInsight, ProductPage } from '../types'
import { removeProductImages, uploadProductMedia } from './productImages.api'

const demo = () => import('./products.demo')

/**
 * Tên danh mục lấy qua khóa ngoại kép (seller_id, category_id) → categories. Ghi rõ tên khóa
 * ngoại vì products còn quan hệ khác; kết quả được làm phẳng thành `category` (xem `toProduct`).
 */
const PRODUCT_COLUMNS =
  'id, sku, name, category_id, category:categories!products_category_same_seller_fkey(name), unit, price, cost_price, stock, low_stock_threshold, is_low_stock, is_active, description, hero_image_path, image_paths, created_at'

/** Dòng trả về từ PostgREST: danh mục là object lồng (hoặc null nếu chưa có danh mục). */
type ProductRow = Omit<Product, 'category'> & { category: { name: string } | null }

export function toProduct(row: ProductRow): Product {
  return { ...row, category: row.category?.name ?? null }
}

/** PostgREST trả lỗi này khi offset vượt quá tổng số dòng (vd. trang cũ sau khi xóa / lọc). */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

/**
 * Lọc tường minh theo shop: seller chỉ thấy shop mình nhờ RLS, nhưng admin đọc được MỌI shop —
 * thiếu điều kiện này thì màn hình admin xem một shop sẽ lẫn dữ liệu shop khác.
 */
function buildListQuery(sellerId: string, filters: ProductFilters, head = false) {
  let query = supabase
    .from('products')
    .select(PRODUCT_COLUMNS, { count: 'exact', head })
    .eq('seller_id', sellerId)

  const term = toSearchTerm(filters.q)
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if (filters.category) query = query.eq('category_id', filters.category)
  if (filters.status === 'active' || filters.status === 'inactive') {
    query = query.eq('is_active', filters.status === 'active')
  }
  if (filters.status === 'needs_category') query = query.is('category_id', null)

  return query
}

/** Danh sách sản phẩm có phân trang, lọc và sắp xếp phía server. */
export async function fetchProducts(
  sellerId: string,
  filters: ProductFilters,
): Promise<ProductPage> {
  if (isDemoMode()) return (await demo()).fetchProducts(sellerId, filters)
  const from = (filters.page - 1) * filters.pageSize
  const { data, error, count } = await buildListQuery(sellerId, filters)
    .order(filters.sort, { ascending: filters.order === 'asc' })
    // Khóa phụ để thứ tự ổn định giữa các trang khi giá trị sắp xếp trùng nhau.
    .order('id', { ascending: true })
    .range(from, from + filters.pageSize - 1)

  if (error) {
    if (getDbErrorInfo(error).code !== RANGE_NOT_SATISFIABLE) throw error
    // Trang vượt quá dữ liệu: trả về tổng để UI tự lùi về trang cuối.
    const head = await buildListQuery(sellerId, filters, true)
    if (head.error) throw head.error
    return { items: [], total: head.count ?? 0 }
  }

  return { items: data.map(toProduct), total: count ?? data.length }
}

/**
 * Tạo sản phẩm: tải ảnh mới lên Storage rồi mới insert. Insert lỗi → xóa ảnh vừa tải để không
 * để lại file rác. SKU do trigger DB tự sinh (DN-TENSANPHAM-STT) và trả về trong kết quả.
 */
export async function createProduct(
  sellerId: string,
  values: ProductFormValues,
  media: ProductMedia,
): Promise<Product> {
  if (isDemoMode()) return (await demo()).createProduct(sellerId, values, media)
  const { uploaded, ...paths } = await uploadProductMedia(sellerId, media)
  const { data, error } = await supabase
    .from('products')
    .insert({ ...values, ...paths })
    .select(PRODUCT_COLUMNS)
    .single()
  if (error) {
    await removeProductImages(uploaded)
    throw error
  }
  return toProduct(data)
}

/**
 * Cập nhật thông tin + ảnh. Tồn kho không sửa ở đây — chỉ đi qua `adjust_stock` để có lịch sử.
 * Ảnh bị gỡ chỉ bị xóa khỏi Storage SAU khi lưu thành công.
 */
export async function updateProduct(
  sellerId: string,
  product: Product,
  values: ProductFormValues,
  media: ProductMedia,
): Promise<Product> {
  if (isDemoMode()) return (await demo()).updateProduct(sellerId, product, values, media)
  const { uploaded, ...paths } = await uploadProductMedia(sellerId, media)
  // Liệt kê tường minh đúng các cột được GRANT UPDATE; SKU cố định sau khi tạo.
  const {
    name,
    category_id,
    unit,
    price,
    cost_price,
    low_stock_threshold,
    is_active,
    description,
  } = values
  const { data, error } = await supabase
    .from('products')
    .update({
      name,
      category_id,
      unit,
      price,
      cost_price,
      low_stock_threshold,
      is_active,
      description,
      ...paths,
    })
    .eq('id', product.id)
    .select(PRODUCT_COLUMNS)
    .single()
  if (error) {
    await removeProductImages(uploaded)
    throw error
  }

  const kept = new Set(mediaPaths(media))
  await removeProductImages(productImagePaths(product).filter((path) => !kept.has(path)))
  return toProduct(data)
}

/** Mọi đường dẫn ảnh đang gắn với sản phẩm. */
export function productImagePaths(product: Pick<Product, 'hero_image_path' | 'image_paths'>) {
  return [product.hero_image_path, ...product.image_paths].filter(
    (path): path is string => path !== null,
  )
}

export async function updateProductPrice(id: string, price: number): Promise<void> {
  if (isDemoMode()) return (await demo()).updateProductPrice(id, price)
  const { error } = await supabase.from('products').update({ price }).eq('id', id)
  if (error) throw error
}

/** Sửa giá vốn hiện hành. Đơn đã xác nhận giữ giá vốn đã chốt (order_items.unit_cost). */
export async function updateProductCost(id: string, costPrice: number): Promise<void> {
  if (isDemoMode()) return (await demo()).updateProductCost(id, costPrice)
  const { error } = await supabase.from('products').update({ cost_price: costPrice }).eq('id', id)
  if (error) throw error
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  if (isDemoMode()) return (await demo()).setProductActive(id, isActive)
  const { error } = await supabase.from('products').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** Hiệu quả sản phẩm (toàn thời gian): bán ra, giá vốn, lợi nhuận gộp, nhập hàng. */
export async function fetchProductInsight(id: string): Promise<ProductInsight> {
  if (isDemoMode()) return (await demo()).fetchProductInsight(id)
  const { data, error } = await supabase.rpc('get_product_insight', { p_product_id: id }).single()
  if (error) throw error
  return data
}
