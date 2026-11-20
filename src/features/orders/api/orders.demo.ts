import {
  DemoDbError,
  matchesTerm,
  newId,
  nowIso,
  padCode,
  nextCounter,
  paginate,
  readDemoDb,
  requireApprovedSeller,
  round,
  sortRows,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import { toSearchTerm } from '@/shared/lib/search'
import type { Tables } from '@/shared/types/database.types'
import { assertTransition, type OrderStatus } from '../domain/orderStatus'
import { PAYMENT_METHODS } from '../domain/paymentMethod'
import type { CreateOrderPayload } from '../schemas/order.schema'
import type { OrderFilters } from '../schemas/orderFilters.schema'
import type { OrderableProduct, OrderDetail, OrderPage, SavedCustomer } from '../types'

/*
 * Backend giả lập (chế độ demo — ADR 011) cho orders.api. Tạo đơn / xác nhận / hủy làm đúng như
 * RPC create_order, confirm_order, cancel_order: kho chỉ trừ khi xác nhận, thiếu hàng thì báo
 * INSUFFICIENT_STOCK và không đổi gì (transaction), hủy đơn đã xác nhận thì hoàn kho.
 */

type OrderRow = Tables<'orders'>

const ORDER_FIELDS = (o: OrderRow) => ({
  id: o.id,
  code: o.code,
  customer_name: o.customer_name,
  customer_phone: o.customer_phone,
  shipping_address: o.shipping_address,
  payment_method: o.payment_method,
  status: o.status,
  total: o.total,
  created_at: o.created_at,
})

export async function fetchOrders(sellerId: string, filters: OrderFilters): Promise<OrderPage> {
  const db = await readDemoDb()
  const term = toSearchTerm(filters.q)
  const rows = db.orders.filter(
    (o) =>
      o.seller_id === sellerId &&
      matchesTerm(term, o.code, o.customer_name, o.customer_phone) &&
      (filters.status === 'all' || o.status === filters.status),
  )
  const sorted = sortRows(rows, (o) => o[filters.sort], filters.order === 'asc')
  const { items, total } = paginate(sorted, filters.page, filters.pageSize)
  return { items: items.map(ORDER_FIELDS), total }
}

export async function fetchOrderDetail(
  sellerId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const db = await readDemoDb()
  const order = db.orders.find((o) => o.id === orderId && o.seller_id === sellerId)
  if (!order) return null
  return {
    ...ORDER_FIELDS(order),
    items: db.order_items
      .filter((i) => i.order_id === order.id)
      .map((i) => {
        const p = db.products.find((product) => product.id === i.product_id)
        return {
          id: i.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: i.unit_cost,
          product: p
            ? { id: p.id, name: p.name, sku: p.sku, stock: p.stock, is_active: p.is_active }
            : null,
        }
      }),
    events: db.order_status_events
      .filter((e) => e.order_id === order.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ id: e.id, status: e.status, created_at: e.created_at })),
  }
}

export async function searchOrderableProducts(
  sellerId: string,
  q: string,
  limit = 20,
): Promise<OrderableProduct[]> {
  const db = await readDemoDb()
  const term = toSearchTerm(q)
  return sortRows(
    db.products.filter(
      (p) => p.seller_id === sellerId && p.is_active && matchesTerm(term, p.name, p.sku),
    ),
    (p) => p.name,
    true,
  )
    .slice(0, limit)
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock }))
}

export async function searchSavedCustomers(
  sellerId: string,
  q: string,
  limit = 20,
): Promise<SavedCustomer[]> {
  const db = await readDemoDb()
  const term = toSearchTerm(q)
  return db.customers
    .filter((c) => c.seller_id === sellerId && matchesTerm(term, c.name, c.phone))
    .sort(
      (a, b) =>
        (b.last_order_at ?? '').localeCompare(a.last_order_at ?? '') ||
        a.name.localeCompare(b.name, 'vi'),
    )
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      payment_method: c.payment_method,
    }))
}

export async function createOrder(payload: CreateOrderPayload): Promise<string> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    const name = payload.customer_name.trim()
    const phone = payload.customer_phone?.trim() || null
    const address = payload.shipping_address?.trim() || null
    if (name.length === 0 || name.length > 200) throw new DemoDbError('INVALID_CUSTOMER')
    if (address && address.length > 500) throw new DemoDbError('INVALID_ADDRESS')
    if (!PAYMENT_METHODS.includes(payload.payment_method)) {
      throw new DemoDbError('INVALID_PAYMENT_METHOD')
    }
    if (payload.save_customer && !phone) throw new DemoDbError('PHONE_REQUIRED_TO_SAVE')
    if (payload.items.length === 0) throw new DemoDbError('ORDER_EMPTY')
    if (payload.items.length > 50) throw new DemoDbError('TOO_MANY_ITEMS')
    if (payload.items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
      throw new DemoDbError('INVALID_QUANTITY')
    }
    if (new Set(payload.items.map((i) => i.product_id)).size !== payload.items.length) {
      throw new DemoDbError('DUPLICATE_PRODUCT')
    }

    const orderId = newId()
    const createdAt = nowIso()
    // Giá chốt = giá bán hiện tại; sản phẩm phải của shop và đang bán (trigger set_order_item_unit_price).
    const items = payload.items.map((line) => {
      const product = db.products.find((p) => p.id === line.product_id && p.seller_id === sellerId)
      if (!product || !product.is_active) {
        throw new DemoDbError('PRODUCT_NOT_AVAILABLE', line.product_id)
      }
      return {
        id: newId(),
        order_id: orderId,
        product_id: product.id,
        quantity: line.quantity,
        unit_price: product.price,
        unit_cost: null,
      }
    })

    db.orders.push({
      id: orderId,
      seller_id: sellerId,
      code: padCode('DH', nextCounter(db, 'order', sellerId)),
      customer_name: name,
      customer_phone: phone,
      shipping_address: address,
      payment_method: payload.payment_method,
      status: 'pending',
      total: items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
      created_at: createdAt,
    })
    db.order_items.push(...items)
    addEvent(db, sellerId, orderId, 'pending', createdAt)

    const saved = phone
      ? db.customers.find((c) => c.seller_id === sellerId && c.phone === phone)
      : undefined
    if (payload.save_customer && phone) {
      if (saved) {
        Object.assign(saved, {
          name,
          address,
          payment_method: payload.payment_method,
          last_order_at: createdAt,
          updated_at: createdAt,
        })
      } else {
        db.customers.push({
          id: newId(),
          seller_id: sellerId,
          name,
          phone,
          address,
          payment_method: payload.payment_method,
          last_order_at: createdAt,
          created_at: createdAt,
          updated_at: createdAt,
        })
      }
    } else if (saved) {
      saved.last_order_at = createdAt
    }
    return orderId
  })
}

function addEvent(
  db: DemoDb,
  sellerId: string,
  orderId: string,
  status: OrderStatus,
  at = nowIso(),
) {
  db.order_status_events.push({
    id: newId(),
    order_id: orderId,
    seller_id: sellerId,
    status,
    created_at: at,
  })
}

/** Như `lock_own_order`: đơn của shop đang đăng nhập. */
function ownOrder(db: DemoDb, orderId: string) {
  const sellerId = requireApprovedSeller(db)
  const order = db.orders.find((o) => o.id === orderId && o.seller_id === sellerId)
  if (!order) throw new DemoDbError('ORDER_NOT_FOUND')
  return { order, sellerId }
}

function confirm(db: DemoDb, orderId: string) {
  const { order, sellerId } = ownOrder(db, orderId)
  if (order.status !== 'pending') throw new DemoDbError('ORDER_NOT_PENDING')
  const items = db.order_items
    .filter((i) => i.order_id === orderId)
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
  if (items.length === 0) throw new DemoDbError('ORDER_EMPTY')

  const at = nowIso()
  for (const item of items) {
    const product = db.products.find((p) => p.id === item.product_id && p.seller_id === sellerId)
    if (!product || product.stock < item.quantity) {
      throw new DemoDbError('INSUFFICIENT_STOCK', item.product_id)
    }
    product.stock -= item.quantity
    item.unit_cost = product.cost_price
    db.inventory_movements.push({
      id: newId(),
      seller_id: sellerId,
      product_id: product.id,
      delta: -item.quantity,
      reason: 'order_confirmed',
      note: null,
      order_id: orderId,
      receipt_id: null,
      unit_cost: product.cost_price,
      created_at: at,
    })
  }
  order.status = 'confirmed'
  addEvent(db, sellerId, orderId, 'confirmed', at)
}

function cancel(db: DemoDb, orderId: string) {
  const { order, sellerId } = ownOrder(db, orderId)
  if (order.status !== 'pending' && order.status !== 'confirmed') {
    throw new DemoDbError('INVALID_STATUS_TRANSITION', `${order.status} -> cancelled`)
  }
  const at = nowIso()
  if (order.status === 'confirmed') {
    for (const item of db.order_items.filter((i) => i.order_id === orderId)) {
      const product = db.products.find((p) => p.id === item.product_id && p.seller_id === sellerId)
      if (!product) continue
      const cost = item.unit_cost ?? product.cost_price
      product.cost_price = round(
        (product.stock * product.cost_price + item.quantity * cost) /
          (product.stock + item.quantity),
        2,
      )
      product.stock += item.quantity
      db.inventory_movements.push({
        id: newId(),
        seller_id: sellerId,
        product_id: product.id,
        delta: item.quantity,
        reason: 'order_cancelled',
        note: null,
        order_id: orderId,
        receipt_id: null,
        unit_cost: cost,
        created_at: at,
      })
    }
  }
  order.status = 'cancelled'
  addEvent(db, sellerId, orderId, 'cancelled', at)
}

function advance(db: DemoDb, orderId: string, from: OrderStatus, to: OrderStatus) {
  const { order, sellerId } = ownOrder(db, orderId)
  if (order.status !== from) {
    throw new DemoDbError('INVALID_STATUS_TRANSITION', `${order.status} -> ${to}`)
  }
  order.status = to
  addEvent(db, sellerId, orderId, to)
}

export async function transitionOrder(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<void> {
  assertTransition(from, to)
  return writeDemoDb((db) => {
    if (to === 'confirmed') confirm(db, orderId)
    else if (to === 'cancelled') cancel(db, orderId)
    else if (to === 'shipping') advance(db, orderId, 'confirmed', 'shipping')
    else if (to === 'delivered') advance(db, orderId, 'shipping', 'delivered')
  })
}
