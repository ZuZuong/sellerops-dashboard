import { isAuthError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  fetchAccounts,
  fetchDeletions,
  fetchPlatformStats,
  fetchSellers,
  setSellerSuspended,
} from '@/features/admin/api/admin.api'
import { fetchSalesSummary } from '@/features/analytics/api/analytics.api'
import { fetchAccount, signIn, signOut } from '@/features/auth/api/auth.api'
import { fetchOrderDetail, createOrder, transitionOrder } from '@/features/orders/api/orders.api'
import { postReceipt, saveReceipt } from '@/features/purchasing/api/purchases.api'
import { fetchOwnSeller } from '@/features/sellers/api/sellers.api'
import { readDemoDb, resetDemoDb } from '@/shared/lib/demo/demoDb'
import { DEMO_ACCOUNTS, endDemoSession, isDemoMode } from '@/shared/lib/demo/demoSession'
import { todayKey, addDays } from '@/shared/lib/dates'

const [ADMIN, SELLER] = DEMO_ACCOUNTS as [
  (typeof DEMO_ACCOUNTS)[number],
  (typeof DEMO_ACCOUNTS)[number],
]

async function loginAs(account: typeof ADMIN) {
  const session = await signIn({ email: account.username, password: account.password })
  return session.user
}

async function sellerContext() {
  const user = await loginAs(SELLER)
  const seller = await fetchOwnSeller(user.id)
  if (!seller) throw new Error('seed thiếu shop demo')
  const db = await readDemoDb()
  const product = db.products.find(
    (p) => p.seller_id === seller.id && p.is_active && p.category_id && p.stock >= 3,
  )
  if (!product) throw new Error('seed thiếu sản phẩm còn hàng')
  return { sellerId: seller.id, product }
}

const stockOf = async (productId: string) =>
  (await readDemoDb()).products.find((p) => p.id === productId)?.stock

beforeEach(() => {
  resetDemoDb()
  endDemoSession()
})

afterEach(() => {
  endDemoSession()
})

describe('đăng nhập tài khoản demo', () => {
  it('sai mật khẩu → lỗi invalid_credentials như Supabase, không vào chế độ demo', async () => {
    const error = await signIn({ email: 'sellertest', password: 'sai-mat-khau' }).catch(
      (e: unknown) => e,
    )
    expect(isAuthError(error) && error.code).toBe('invalid_credentials')
    expect(isDemoMode()).toBe(false)
  })

  it('đúng mật khẩu → phiên demo, role đọc từ profiles giả lập; đăng xuất thoát chế độ demo', async () => {
    const user = await loginAs(ADMIN)
    expect(isDemoMode()).toBe(true)
    expect(await fetchAccount(user)).toMatchObject({ role: 'admin', isLocked: false })

    await signOut()
    expect(isDemoMode()).toBe(false)
  })
})

describe('dữ liệu mẫu nhất quán', () => {
  it('tồn kho mỗi sản phẩm = tổng biến động kho, không âm; đơn đã xác nhận có giá vốn chốt', async () => {
    await loginAs(SELLER)
    const db = await readDemoDb()
    for (const product of db.products) {
      const moved = db.inventory_movements
        .filter((m) => m.product_id === product.id)
        .reduce((sum, m) => sum + m.delta, 0)
      expect(product.stock).toBe(moved)
      expect(product.stock).toBeGreaterThanOrEqual(0)
    }
    const confirmed = new Set(
      db.orders
        .filter((o) => ['confirmed', 'shipping', 'delivered'].includes(o.status))
        .map((o) => o.id),
    )
    const items = db.order_items.filter((i) => confirmed.has(i.order_id))
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.unit_cost !== null)).toBe(true)
  })
})

describe('luồng đơn hàng (như RPC create / confirm / cancel)', () => {
  it('tạo đơn không trừ kho; xác nhận trừ kho + ghi biến động; hủy đơn đã xác nhận hoàn kho', async () => {
    const { sellerId, product } = await sellerContext()
    const before = product.stock

    const orderId = await createOrder({
      customer_name: 'Khách test',
      customer_phone: null,
      shipping_address: null,
      payment_method: 'cod',
      save_customer: false,
      items: [{ product_id: product.id, quantity: 2 }],
    })
    const created = await fetchOrderDetail(sellerId, orderId)
    expect(created).toMatchObject({ status: 'pending', total: product.price * 2 })
    expect(await stockOf(product.id)).toBe(before)

    await transitionOrder(orderId, 'pending', 'confirmed')
    expect(await stockOf(product.id)).toBe(before - 2)
    const db = await readDemoDb()
    expect(
      db.inventory_movements.some(
        (m) => m.order_id === orderId && m.reason === 'order_confirmed' && m.delta === -2,
      ),
    ).toBe(true)

    await transitionOrder(orderId, 'confirmed', 'cancelled')
    expect(await stockOf(product.id)).toBe(before)
    expect((await fetchOrderDetail(sellerId, orderId))?.events.map((e) => e.status)).toEqual([
      'pending',
      'confirmed',
      'cancelled',
    ])
  })

  it('thiếu hàng → INSUFFICIENT_STOCK, đơn vẫn chờ xác nhận và tồn kho không đổi', async () => {
    const { sellerId, product } = await sellerContext()
    const orderId = await createOrder({
      customer_name: 'Khách test',
      customer_phone: null,
      shipping_address: null,
      payment_method: 'cod',
      save_customer: false,
      items: [{ product_id: product.id, quantity: product.stock + 1 }],
    })

    await expect(transitionOrder(orderId, 'pending', 'confirmed')).rejects.toMatchObject({
      message: 'INSUFFICIENT_STOCK',
      details: product.id,
    })
    expect(await stockOf(product.id)).toBe(product.stock)
    expect((await fetchOrderDetail(sellerId, orderId))?.status).toBe('pending')
  })

  it('xác nhận đơn đã xử lý → ORDER_NOT_PENDING', async () => {
    const { product } = await sellerContext()
    const orderId = await createOrder({
      customer_name: 'Khách test',
      customer_phone: null,
      shipping_address: null,
      payment_method: 'cod',
      save_customer: false,
      items: [{ product_id: product.id, quantity: 1 }],
    })
    await transitionOrder(orderId, 'pending', 'cancelled')
    // UI cũ còn nghĩ đơn đang chờ (vd. tab khác đã hủy).
    await expect(transitionOrder(orderId, 'pending', 'confirmed')).rejects.toMatchObject({
      message: 'ORDER_NOT_PENDING',
    })
  })
})

describe('nhập hàng', () => {
  it('duyệt phiếu cộng tồn và tính giá vốn bình quân gia quyền', async () => {
    const { product } = await sellerContext()
    const receiptId = await saveReceipt(null, {
      header: {
        supplier_name: 'NCC test',
        supplier_phone: null,
        invoice_number: null,
        delivered_by: null,
        received_date: todayKey(),
        note: null,
      },
      items: [
        {
          product_id: product.id,
          ordered_qty: 10,
          received_qty: 10,
          defective_qty: 0,
          unit_cost: 100_000,
          condition_note: null,
        },
      ],
    })
    await postReceipt(receiptId)

    const after = (await readDemoDb()).products.find((p) => p.id === product.id)
    expect(after?.stock).toBe(product.stock + 10)
    const expected =
      Math.round(
        ((product.stock * product.cost_price + 10 * 100_000) / (product.stock + 10)) * 100,
      ) / 100
    expect(after?.cost_price).toBe(expected)
  })
})

describe('phân quyền như RLS / RPC', () => {
  it('seller không gọi được hàm admin và không xem báo cáo shop khác', async () => {
    await loginAs(SELLER)
    await expect(fetchPlatformStats(30)).rejects.toMatchObject({ message: 'NOT_ADMIN' })

    const range = { from: addDays(todayKey(), -29), to: todayKey() }
    await expect(
      fetchSalesSummary('00000000-0000-4000-8000-0000000000ff', range),
    ).rejects.toMatchObject({ message: 'FORBIDDEN' })
  })

  it('admin tạm khóa shop → seller không ghi được (SELLER_NOT_APPROVED); mở khóa → ghi lại được, có audit_logs', async () => {
    const { sellerId, product } = await sellerContext()
    const order = {
      customer_name: 'Khách test',
      customer_phone: null,
      shipping_address: null,
      payment_method: 'cod' as const,
      save_customer: false,
      items: [{ product_id: product.id, quantity: 1 }],
    }

    await loginAs(ADMIN)
    await setSellerSuspended(sellerId, true, 'Kiểm tra vi phạm')
    await loginAs(SELLER)
    await expect(createOrder(order)).rejects.toMatchObject({ message: 'SELLER_NOT_APPROVED' })

    await loginAs(ADMIN)
    await setSellerSuspended(sellerId, false, '')
    await loginAs(SELLER)
    await expect(createOrder(order)).resolves.toEqual(expect.any(String))

    const actions = (await readDemoDb()).audit_logs
      .filter((a) => a.target_id === sellerId)
      .map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['seller.suspended', 'seller.unsuspended']))
  })
})

describe('cô lập: tài khoản dùng thử chỉ thấy nhau', () => {
  it('admintest chỉ thấy đúng tài khoản admintest + sellertest và đúng một shop của sellertest', async () => {
    await loginAs(ADMIN)
    const sellers = await fetchSellers({ q: '', status: 'all', page: 1, pageSize: 100 })
    expect(sellers.items.map((s) => s.owner_email)).toEqual([SELLER.email])

    const accounts = await fetchAccounts({
      q: '',
      role: 'all',
      state: 'all',
      page: 1,
      pageSize: 100,
    })
    expect(accounts.items.map((a) => a.email).sort()).toEqual([ADMIN.email, SELLER.email].sort())
    expect((await fetchDeletions({ q: '', status: 'all', page: 1, pageSize: 100 })).total).toBe(0)
  })

  it('mọi dữ liệu kinh doanh trong bộ mẫu đều thuộc shop của sellertest', async () => {
    const { sellerId } = await sellerContext()
    const db = await readDemoDb()
    expect(db.sellers.map((s) => s.id)).toEqual([sellerId])
    for (const table of [
      db.products,
      db.categories,
      db.orders,
      db.customers,
      db.inventory_movements,
      db.purchase_receipts,
      db.product_trash,
    ]) {
      expect(table.every((row) => row.seller_id === sellerId)).toBe(true)
    }
  })
})
