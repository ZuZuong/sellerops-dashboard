import { getDbErrorInfo } from '@/shared/lib/errors'
import { toSearchTerm } from '@/shared/lib/search'
import { supabase } from '@/shared/lib/supabase'
import { assertTransition, type OrderStatus } from '../domain/orderStatus'
import type { CreateOrderPayload } from '../schemas/order.schema'
import type { OrderFilters } from '../schemas/orderFilters.schema'
import type { OrderableProduct, OrderDetail, OrderPage } from '../types'

const ORDER_COLUMNS = 'id, code, customer_name, customer_phone, status, total, created_at'

const ORDER_DETAIL_COLUMNS = `${ORDER_COLUMNS},
  items:order_items(id, product_id, quantity, unit_price, product:products(id, name, sku, stock, is_active)),
  events:order_status_events(id, status, created_at)`

/** PostgREST trả lỗi này khi offset vượt quá tổng số dòng (vd. trang cũ sau khi lọc). */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

function buildListQuery(filters: OrderFilters, head = false) {
  let query = supabase.from('orders').select(ORDER_COLUMNS, { count: 'exact', head })

  const term = toSearchTerm(filters.q)
  if (term) {
    query = query.or(
      `code.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    )
  }
  if (filters.status !== 'all') query = query.eq('status', filters.status)

  return query
}

/** Danh sách đơn có phân trang, lọc theo trạng thái, tìm theo mã / tên / SĐT khách phía server. */
export async function fetchOrders(filters: OrderFilters): Promise<OrderPage> {
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

/** Chi tiết đơn: thông tin, dòng hàng (kèm sản phẩm) và lịch sử trạng thái. `null` nếu không có. */
export async function fetchOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_DETAIL_COLUMNS)
    .eq('id', orderId)
    .order('created_at', { referencedTable: 'order_status_events', ascending: true })
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Sản phẩm đang bán để thêm vào đơn, tìm theo tên / SKU. Giới hạn số dòng: ô chọn sản phẩm
 * tìm phía server khi gõ, không tải toàn bộ danh mục.
 */
export async function searchOrderableProducts(q: string, limit = 20): Promise<OrderableProduct[]> {
  let query = supabase.from('products').select('id, name, sku, price, stock').eq('is_active', true)
  const term = toSearchTerm(q)
  if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  const { data, error } = await query.order('name').limit(limit)
  if (error) throw error
  return data
}

/**
 * Tạo đơn qua RPC: đơn + các dòng hàng trong một transaction; mã đơn, giá chốt và tổng tiền do DB
 * tính. Không trừ kho (kho chỉ trừ khi xác nhận). Trả về id đơn mới.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: payload.customer_name,
    // RPC nhận chuỗi rỗng = không có số điện thoại.
    p_customer_phone: payload.customer_phone ?? '',
    p_items: payload.items,
  })
  if (error) throw error
  return data
}

const TRANSITION_RPC = {
  confirmed: 'confirm_order',
  shipping: 'ship_order',
  delivered: 'deliver_order',
  cancelled: 'cancel_order',
} as const

/**
 * Chuyển trạng thái đơn qua RPC tương ứng. Kiểm tra state machine trước để không gửi yêu cầu
 * chắc chắn sai; RPC vẫn kiểm tra lại trong transaction (trạng thái có thể đã đổi ở tab khác).
 * Trừ / hoàn kho và ghi `inventory_movements` đều nằm trong RPC — client không đụng tới kho.
 */
export async function transitionOrder(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<void> {
  assertTransition(from, to)
  const { error } = await supabase.rpc(TRANSITION_RPC[to], { p_order_id: orderId })
  if (error) throw error
}
