import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { getDbErrorInfo } from '@/shared/lib/errors'
import { toSearchTerm } from '@/shared/lib/search'
import { supabase } from '@/shared/lib/supabase'
import type { ReceiptPayload } from '../schemas/receipt.schema'
import type { ReceiptFilters } from '../schemas/receiptFilters.schema'
import type { PurchaseReceiptPage, ReceiptDetail, ReceiptProduct } from '../types'

const demo = () => import('./purchases.demo')

const LIST_COLUMNS = `id, code, status, supplier_name, supplier_phone, invoice_number, received_date,
  total_amount, created_at, posted_at, items:purchase_receipt_items(received_qty, defective_qty)`

const DETAIL_COLUMNS = `id, code, status, supplier_name, supplier_phone, invoice_number, delivered_by,
  received_date, note, total_amount, created_at, updated_at, posted_at,
  items:purchase_receipt_items(id, product_id, ordered_qty, received_qty, defective_qty, unit_cost,
    condition_note, position, product:products(id, name, sku, unit, stock, cost_price))`

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Lọc tường minh theo shop (admin đọc được mọi shop, không chỉ dựa vào RLS). */
function buildListQuery(sellerId: string, filters: ReceiptFilters, head = false) {
  let query = supabase
    .from('purchase_receipts')
    .select(LIST_COLUMNS, { count: 'exact', head })
    .eq('seller_id', sellerId)
  const term = toSearchTerm(filters.q)
  if (term) {
    query = query.or(
      `code.ilike.%${term}%,supplier_name.ilike.%${term}%,invoice_number.ilike.%${term}%`,
    )
  }
  if (filters.status !== 'all') query = query.eq('status', filters.status)
  return query
}

/** Danh sách phiếu nhập (mới nhất trước), lọc / tìm / phân trang phía server. */
export async function fetchReceipts(
  sellerId: string,
  filters: ReceiptFilters,
): Promise<PurchaseReceiptPage> {
  if (isDemoMode()) return (await demo()).fetchReceipts(sellerId, filters)
  const from = (filters.page - 1) * filters.pageSize
  const { data, error, count } = await buildListQuery(sellerId, filters)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + filters.pageSize - 1)

  if (error) {
    if (getDbErrorInfo(error).code !== RANGE_NOT_SATISFIABLE) throw error
    const head = await buildListQuery(sellerId, filters, true)
    if (head.error) throw head.error
    return { items: [], total: head.count ?? 0 }
  }

  return {
    items: data.map(({ items, ...receipt }) => ({
      ...receipt,
      received_qty: items.reduce((sum, item) => sum + item.received_qty, 0),
      defective_qty: items.reduce((sum, item) => sum + item.defective_qty, 0),
    })),
    total: count ?? data.length,
  }
}

/** Chi tiết phiếu kèm dòng hàng (đúng thứ tự nhập). `null` nếu không có / không thuộc shop. */
export async function fetchReceipt(sellerId: string, id: string): Promise<ReceiptDetail | null> {
  if (isDemoMode()) return (await demo()).fetchReceipt(sellerId, id)
  const { data, error } = await supabase
    .from('purchase_receipts')
    .select(DETAIL_COLUMNS)
    .eq('seller_id', sellerId)
    .eq('id', id)
    .order('position', { referencedTable: 'purchase_receipt_items', ascending: true })
    .maybeSingle()
  if (error) throw error
  return data
}

/** Sản phẩm để chọn trên phiếu nhập (gồm cả sản phẩm chưa đăng bán — vẫn nhập kho được). */
export async function searchReceiptProducts(
  sellerId: string,
  q: string,
  limit = 20,
): Promise<ReceiptProduct[]> {
  if (isDemoMode()) return (await demo()).searchReceiptProducts(sellerId, q, limit)
  let query = supabase
    .from('products')
    .select('id, name, sku, unit, stock, cost_price')
    .eq('seller_id', sellerId)
  const term = toSearchTerm(q)
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  const { data, error } = await query.order('name').limit(limit)
  if (error) throw error
  return data
}

/** Lưu phiếu NHÁP (tạo mới khi `id` null); chưa ảnh hưởng tồn kho. Trả về id phiếu. */
export async function saveReceipt(id: string | null, payload: ReceiptPayload): Promise<string> {
  if (isDemoMode()) return (await demo()).saveReceipt(id, payload)
  const { data, error } = await supabase.rpc('save_purchase_receipt', {
    // RPC nhận null để tạo phiếu mới (kiểu sinh tự động khai báo string).
    p_receipt_id: id as string,
    p_header: payload.header,
    p_items: payload.items,
  })
  if (error) throw error
  return data
}

/**
 * Duyệt nhập kho qua RPC: cộng tồn SL thực nhận, cập nhật giá vốn bình quân, ghi lịch sử kho —
 * một transaction. Sau bước này phiếu không sửa / xóa được.
 */
export async function postReceipt(id: string): Promise<void> {
  if (isDemoMode()) return (await demo()).postReceipt(id)
  const { error } = await supabase.rpc('post_purchase_receipt', { p_receipt_id: id })
  if (error) throw error
}

/** Xóa phiếu nháp (DB từ chối phiếu đã nhập kho). */
export async function deleteReceipt(id: string): Promise<void> {
  if (isDemoMode()) return (await demo()).deleteReceipt(id)
  const { error } = await supabase.rpc('delete_purchase_receipt', { p_receipt_id: id })
  if (error) throw error
}
