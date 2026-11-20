import type { Enums, Json, Tables } from '@/shared/types/database.types'
import { DEMO_ACCOUNTS } from './demoSession'
import {
  DEMO_DB_VERSION,
  dateKeyOf,
  padCode,
  round,
  startOfDateKey,
  type DemoDb,
  type DemoUser,
} from './demoDb'

/*
 * Dữ liệu mẫu của chế độ demo, sinh lại mỗi khi tab mới đăng nhập demo. Dùng PRNG có seed cố định
 * nên lần nào cũng ra cùng một bộ số liệu (chỉ mốc thời gian dịch theo ngày hiện tại).
 *
 * Mọi số liệu nhất quán như dữ liệu thật: tồn kho = nhập − bán (có `inventory_movements`), đơn đã
 * xác nhận có giá vốn chốt, phiếu nhập cập nhật giá vốn bình quân gia quyền.
 */

const DAY_MS = 86_400_000

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number

function uuidFrom(rand: Rand): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16))
  hex[12] = '4'
  hex[16] = ((Math.floor(rand() * 4) + 8) as number).toString(16)
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

const pickWeighted = <T>(rand: Rand, options: ReadonlyArray<readonly [T, number]>): T => {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rand() * total
  for (const [value, weight] of options) {
    roll -= weight
    if (roll <= 0) return value
  }
  return options[options.length - 1]![0]
}

const randInt = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

function skuNamePart(name: string): string {
  const part = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return part || 'SP'
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface CatalogItem {
  name: string
  unit: string
  price: number
  cost: number
  /** Số lượng nhập ban đầu. */
  qty: number
  threshold?: number
  active?: boolean
  description?: string
}

interface ShopPlan {
  sellerId: string
  categories: Array<{ name: string; items: CatalogItem[] }>
  /** Sản phẩm chưa phân loại (minh họa bộ lọc "Cần gán danh mục"). */
  uncategorized?: CatalogItem[]
  orderCount: number
  /** Đơn hàng trải trong N ngày gần đây. */
  spanDays: number
  restock?: Array<{ name: string; qty: number; cost: number; daysAgo: number }>
  draftReceipt?: boolean
  trash?: CatalogItem[]
}

const CUSTOMERS = [
  ['Trần Thị Mai', '0901234567', '12 Nguyễn Trãi, P. Bến Thành, Q.1, TP.HCM'],
  ['Lê Hoàng Nam', '0912345678', '45 Lê Lợi, Q. Hải Châu, Đà Nẵng'],
  ['Phạm Minh Châu', '0987654321', '88 Cầu Giấy, Q. Cầu Giấy, Hà Nội'],
  ['Võ Thanh Tùng', '0938111222', '23 Trần Hưng Đạo, TP. Quy Nhơn'],
  ['Đặng Thu Hà', '0977333444', '102 Hai Bà Trưng, Q.3, TP.HCM'],
  ['Bùi Quốc Bảo', '0966555777', '7 Lý Thường Kiệt, TP. Huế'],
  ['Ngô Phương Linh', '0909888999', '56 Nguyễn Văn Linh, Q.7, TP.HCM'],
  ['Hoàng Đức Anh', '0945666777', '31 Bạch Đằng, Q. Hồng Bàng, Hải Phòng'],
  ['Huỳnh Ngọc Trâm', '0918222333', '9 Mậu Thân, Q. Ninh Kiều, Cần Thơ'],
  ['Đỗ Gia Huy', '0973444555', '140 Tôn Đức Thắng, Q. Đống Đa, Hà Nội'],
  ['Phan Thảo Vy', '0932777888', '61 Phan Đình Phùng, TP. Đà Lạt'],
  ['Trịnh Khánh Duy', '0961000111', '18 Hùng Vương, TP. Nha Trang'],
] as const

const SUPPLIERS = [
  ['Xưởng may Thành Công', '0283456789'],
  ['Công ty TNHH Dệt Phong Phú', '0287654321'],
  ['Kho sỉ Tân Bình', '0909123123'],
] as const

export function createSeedDb(now: Date): DemoDb {
  const rand = mulberry32(20_261_120)
  const id = () => uuidFrom(rand)
  const nowMs = now.getTime()
  const todayStart = startOfDateKey(dateKeyOf(nowMs))
  /** Thời điểm `days` ngày trước lúc `hour` giờ (giờ VN), không vượt quá hiện tại. */
  const at = (days: number, hour = 10, minute = 0) =>
    new Date(
      Math.min(todayStart - days * DAY_MS + (hour * 60 + minute) * 60_000, nowMs - 60_000),
    ).toISOString()

  const db: DemoDb = {
    version: DEMO_DB_VERSION,
    users: [],
    profiles: [],
    sellers: [],
    categories: [],
    products: [],
    orders: [],
    order_items: [],
    order_status_events: [],
    customers: [],
    inventory_movements: [],
    purchase_receipts: [],
    purchase_receipt_items: [],
    product_imports: [],
    product_trash: [],
    seller_documents: [],
    audit_logs: [],
    account_deletions: [],
    account_deletion_evidence: [],
    activity_logs: [],
    counters: { order: {}, receipt: {}, sku: {} },
  }

  // ---------------------------------------------------------------------------
  // Tài khoản
  // ---------------------------------------------------------------------------
  const [adminAccount, sellerAccount] = DEMO_ACCOUNTS
  if (!adminAccount || !sellerAccount) throw new Error('DEMO_ACCOUNTS_MISSING')
  const adminId = adminAccount.userId

  function addUser(input: {
    id?: string
    email: string
    fullName: string | null
    role: Enums<'user_role'>
    createdDaysAgo: number
    phone?: string
    lastSignInDaysAgo?: number | null
    locked?: { reason: string; daysAgo: number }
    status?: Enums<'account_status'>
  }): string {
    const userId = input.id ?? id()
    const user: DemoUser = {
      id: userId,
      email: input.email,
      created_at: at(input.createdDaysAgo, 9),
      last_sign_in_at:
        input.lastSignInDaysAgo === null ? null : at(input.lastSignInDaysAgo ?? 1, 20),
    }
    db.users.push(user)
    db.profiles.push({
      id: userId,
      role: input.role,
      full_name: input.fullName,
      phone: input.phone ?? null,
      is_locked: Boolean(input.locked),
      locked_reason: input.locked?.reason ?? null,
      locked_at: input.locked ? at(input.locked.daysAgo, 15) : null,
      account_status: input.status ?? 'active',
      created_at: user.created_at,
    })
    return userId
  }

  addUser({
    id: adminId,
    email: adminAccount.email,
    fullName: adminAccount.fullName,
    role: 'admin',
    createdDaysAgo: 120,
    lastSignInDaysAgo: 0,
  })
  const demoSellerUser = addUser({
    id: sellerAccount.userId,
    email: sellerAccount.email,
    fullName: sellerAccount.fullName,
    role: 'seller',
    createdDaysAgo: 90,
    phone: '0901000001',
    lastSignInDaysAgo: 0,
  })

  // ---------------------------------------------------------------------------
  // Shop
  // ---------------------------------------------------------------------------
  function addSeller(input: {
    ownerId: string
    shopName: string
    status: Enums<'seller_status'>
    businessType: Enums<'business_type'>
    businessName: string
    taxCode: string
    mainCategory: string
    address: string
    representative: string
    phone: string
    email: string
    createdDaysAgo: number
    submittedDaysAgo?: number
    reviewedDaysAgo?: number
    rejectionReason?: string
    suspendedReason?: string
    currentStep?: number
  }): string {
    const sellerId = id()
    const submitted = input.submittedDaysAgo !== undefined
    db.sellers.push({
      id: sellerId,
      owner_id: input.ownerId,
      shop_name: input.shopName,
      slug: slugify(input.shopName),
      status: input.status,
      business_type: input.businessType,
      business_name: input.businessName,
      tax_code: input.taxCode,
      license_number: `GP-${input.taxCode.slice(0, 6)}`,
      main_category: input.mainCategory,
      address: input.address,
      representative_name: input.representative,
      representative_phone: input.phone,
      contact_email: input.email,
      current_step: input.currentStep ?? 4,
      created_at: at(input.createdDaysAgo, 9, 30),
      updated_at: at(Math.min(input.createdDaysAgo, input.reviewedDaysAgo ?? 0), 16),
      submitted_at: submitted ? at(input.submittedDaysAgo ?? 0, 11) : null,
      reviewed_at: input.reviewedDaysAgo !== undefined ? at(input.reviewedDaysAgo, 14) : null,
      reviewed_by: input.reviewedDaysAgo !== undefined ? adminId : null,
      rejection_reason: input.rejectionReason ?? null,
      suspended_reason: input.suspendedReason ?? null,
      terms_accepted_at: submitted ? at(input.submittedDaysAgo ?? 0, 11) : null,
      terms_version: submitted ? '2026-11' : null,
      former_owner_email: null,
      former_owner_id: null,
      former_owner_name: null,
      owner_removed_at: null,
    })
    if (submitted) {
      for (const kind of ['business_license', 'representative_id'] as const) {
        const fileName = kind === 'business_license' ? 'giay-phep-kinh-doanh.pdf' : 'cccd.jpg'
        db.seller_documents.push({
          id: id(),
          seller_id: sellerId,
          kind,
          storage_path: `${input.ownerId}/${kind}/${fileName}`,
          file_name: fileName,
          mime_type: kind === 'business_license' ? 'application/pdf' : 'image/jpeg',
          file_size: randInt(rand, 180_000, 1_400_000),
          created_at: at(input.submittedDaysAgo ?? 0, 10, 45),
        })
      }
      db.audit_logs.push({
        id: id(),
        actor_id: input.ownerId,
        action: 'seller.submitted',
        target_type: 'seller',
        target_id: sellerId,
        metadata: {},
        created_at: at(input.submittedDaysAgo ?? 0, 11),
      })
    }
    if (input.reviewedDaysAgo !== undefined) {
      const rejected = input.status === 'rejected'
      db.audit_logs.push({
        id: id(),
        actor_id: adminId,
        action: rejected ? 'seller.rejected' : 'seller.approved',
        target_type: 'seller',
        target_id: sellerId,
        metadata: rejected ? { reason: input.rejectionReason ?? '' } : {},
        created_at: at(input.reviewedDaysAgo, 14),
      })
    }
    return sellerId
  }

  const demoShop = addSeller({
    ownerId: demoSellerUser,
    shopName: 'Thời Trang Demo',
    status: 'approved',
    businessType: 'household',
    businessName: 'Hộ kinh doanh Thời Trang Demo',
    taxCode: '0312345678',
    mainCategory: 'Thời trang',
    address: '25 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM',
    representative: sellerAccount.fullName,
    phone: '0901000001',
    email: sellerAccount.email,
    createdDaysAgo: 90,
    submittedDaysAgo: 88,
    reviewedDaysAgo: 87,
  })
  // ---------------------------------------------------------------------------
  // Sản phẩm, phiếu nhập, đơn hàng của từng shop
  // ---------------------------------------------------------------------------
  function buildShop(plan: ShopPlan): void {
    const { sellerId } = plan
    const created = at(plan.spanDays + 6, 8)
    const products = new Map<string, Tables<'products'>>()

    const addProduct = (item: CatalogItem, categoryId: string | null) => {
      const seq = (db.counters.sku[sellerId] ?? 0) + 1
      db.counters.sku[sellerId] = seq
      const product: Tables<'products'> = {
        id: id(),
        seller_id: sellerId,
        sku: `DN-${skuNamePart(item.name)}-${String(seq).padStart(3, '0')}`,
        name: item.name,
        category_id: categoryId,
        unit: item.unit,
        price: item.price,
        cost_price: item.cost,
        stock: 0,
        low_stock_threshold: item.threshold ?? 10,
        is_low_stock: true,
        is_active: item.active ?? true,
        description: item.description ?? null,
        hero_image_path: null,
        image_paths: [],
        import_id: null,
        created_at: created,
      }
      db.products.push(product)
      products.set(item.name, product)
      return product
    }

    plan.categories.forEach((category, index) => {
      const categoryId = id()
      db.categories.push({
        id: categoryId,
        seller_id: sellerId,
        name: category.name,
        slug: slugify(category.name),
        sort_order: index + 1,
        is_active: true,
        created_at: created,
      })
      category.items.forEach((item) => addProduct(item, categoryId))
    })
    plan.uncategorized?.forEach((item) => addProduct(item, null))

    // Phiếu nhập đầu kỳ cho toàn bộ hàng.
    const postReceipt = (
      lines: Array<{ product: Tables<'products'>; qty: number; cost: number }>,
      daysAgo: number,
      supplier: readonly [string, string],
      status: Enums<'receipt_status'> = 'posted',
    ) => {
      const receiptId = id()
      const createdAt = at(daysAgo, 9)
      const postedAt = status === 'posted' ? at(daysAgo, 10) : null
      db.purchase_receipts.push({
        id: receiptId,
        seller_id: sellerId,
        code: padCode(
          'PN',
          (db.counters.receipt[sellerId] = (db.counters.receipt[sellerId] ?? 0) + 1),
        ),
        status,
        supplier_name: supplier[0],
        supplier_phone: supplier[1],
        invoice_number: status === 'posted' ? `HD${randInt(rand, 10000, 99999)}` : null,
        delivered_by: status === 'posted' ? 'Anh Tài (xe tải)' : null,
        received_date: dateKeyOf(createdAt),
        note: status === 'draft' ? 'Chờ nhà cung cấp xác nhận số lượng' : null,
        total_amount: round(lines.reduce((sum, line) => sum + line.qty * line.cost, 0)),
        created_at: createdAt,
        updated_at: postedAt ?? createdAt,
        posted_at: postedAt,
      })
      lines.forEach((line, index) => {
        db.purchase_receipt_items.push({
          id: id(),
          receipt_id: receiptId,
          product_id: line.product.id,
          ordered_qty: line.qty,
          received_qty: line.qty,
          defective_qty: 0,
          unit_cost: line.cost,
          condition_note: null,
          position: index + 1,
        })
        if (status !== 'posted') return
        const p = line.product
        p.cost_price = round(
          (p.stock * p.cost_price + line.qty * line.cost) / (p.stock + line.qty),
          2,
        )
        p.stock += line.qty
        db.inventory_movements.push({
          id: id(),
          seller_id: sellerId,
          product_id: p.id,
          delta: line.qty,
          reason: 'purchase_receipt',
          note: null,
          order_id: null,
          receipt_id: receiptId,
          unit_cost: line.cost,
          created_at: postedAt ?? createdAt,
        })
      })
    }

    const catalog = [...plan.categories.flatMap((c) => c.items), ...(plan.uncategorized ?? [])]
    postReceipt(
      catalog.map((item) => ({
        product: products.get(item.name)!,
        qty: item.qty,
        cost: item.cost,
      })),
      plan.spanDays + 5,
      SUPPLIERS[0],
    )

    // Khách đã lưu của shop.
    const savedCustomers = CUSTOMERS.slice(0, 8)
    for (const [name, phone, address] of savedCustomers) {
      db.customers.push({
        id: id(),
        seller_id: sellerId,
        name,
        phone,
        address,
        payment_method: 'cod',
        last_order_at: null,
        created_at: created,
        updated_at: created,
      })
    }

    // Đơn hàng + phiếu nhập bổ sung theo dòng thời gian.
    type Event = { at: number; kind: 'order' } | { at: number; kind: 'restock'; index: number }
    const events: Event[] = []
    for (let i = 0; i < plan.orderCount; i += 1) {
      const daysAgo = Math.floor(rand() ** 1.4 * plan.spanDays)
      events.push({
        kind: 'order',
        at: Date.parse(at(daysAgo, randInt(rand, 8, 21), randInt(rand, 0, 59))),
      })
    }
    plan.restock?.forEach((r, index) =>
      events.push({ kind: 'restock', index, at: Date.parse(at(r.daysAgo, 9)) }),
    )
    events.sort((a, b) => a.at - b.at)

    const sellable = [...products.values()].filter((p) => p.is_active && p.category_id)

    for (const event of events) {
      if (event.kind === 'restock') {
        const r = plan.restock?.[event.index]
        const product = r && products.get(r.name)
        if (r && product) {
          postReceipt(
            [{ product, qty: r.qty, cost: r.cost }],
            Math.round((todayStart - event.at) / DAY_MS),
            SUPPLIERS[1],
          )
        }
        continue
      }

      const ageDays = (nowMs - event.at) / DAY_MS
      const status = pickWeighted<Enums<'order_status'>>(
        rand,
        ageDays > 7
          ? [
              ['delivered', 86],
              ['cancelled', 14],
            ]
          : ageDays > 2
            ? [
                ['delivered', 40],
                ['shipping', 30],
                ['confirmed', 15],
                ['cancelled', 15],
              ]
            : [
                ['pending', 45],
                ['confirmed', 25],
                ['shipping', 15],
                ['cancelled', 15],
              ],
      )
      const confirmedBeforeCancel = status === 'cancelled' && rand() < 0.35
      const touchesStock = status !== 'pending' && (status !== 'cancelled' || confirmedBeforeCancel)

      // Chọn 1–3 sản phẩm khác nhau, số lượng 1–3.
      const lineCount = pickWeighted(rand, [
        [1, 55],
        [2, 30],
        [3, 15],
      ] as const)
      const lines: Array<{ product: Tables<'products'>; quantity: number }> = []
      for (let tries = 0; lines.length < lineCount && tries < 10; tries += 1) {
        const product = sellable[Math.floor(rand() * sellable.length)]
        if (!product || lines.some((l) => l.product.id === product.id)) continue
        const quantity = pickWeighted(rand, [
          [1, 70],
          [2, 22],
          [3, 8],
        ] as const)
        if (touchesStock && product.stock < quantity) continue
        lines.push({ product, quantity })
      }
      if (lines.length === 0) continue

      const customer = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)]!
      const payment = pickWeighted<Enums<'payment_method'>>(rand, [
        ['cod', 50],
        ['bank_transfer', 25],
        ['e_wallet', 15],
        ['cash', 5],
        ['card', 5],
      ])
      const orderId = id()
      const createdAt = new Date(event.at).toISOString()
      const step = (hours: number) =>
        new Date(Math.min(event.at + hours * 3600_000, nowMs - 30_000)).toISOString()
      const total = lines.reduce((sum, l) => sum + l.quantity * l.product.price, 0)

      db.orders.push({
        id: orderId,
        seller_id: sellerId,
        code: padCode('DH', (db.counters.order[sellerId] = (db.counters.order[sellerId] ?? 0) + 1)),
        customer_name: customer[0],
        customer_phone: customer[1],
        shipping_address: customer[2],
        payment_method: payment,
        status,
        total,
        created_at: createdAt,
      })
      const saved = db.customers.find((c) => c.seller_id === sellerId && c.phone === customer[1])
      if (saved) saved.last_order_at = createdAt

      const confirmAt = step(randInt(rand, 1, 5))
      const items = lines.map((l) => {
        const item: Tables<'order_items'> = {
          id: id(),
          order_id: orderId,
          product_id: l.product.id,
          quantity: l.quantity,
          unit_price: l.product.price,
          unit_cost: null,
        }
        db.order_items.push(item)
        return { item, product: l.product }
      })

      const addEvent = (s: Enums<'order_status'>, when: string) =>
        db.order_status_events.push({
          id: id(),
          order_id: orderId,
          seller_id: sellerId,
          status: s,
          created_at: when,
        })
      addEvent('pending', createdAt)

      if (touchesStock) {
        for (const { item, product } of items) {
          product.stock -= item.quantity
          item.unit_cost = product.cost_price
          db.inventory_movements.push({
            id: id(),
            seller_id: sellerId,
            product_id: product.id,
            delta: -item.quantity,
            reason: 'order_confirmed',
            note: null,
            order_id: orderId,
            receipt_id: null,
            unit_cost: product.cost_price,
            created_at: confirmAt,
          })
        }
        addEvent('confirmed', confirmAt)
      }

      if (status === 'shipping' || status === 'delivered') addEvent('shipping', step(26))
      if (status === 'delivered') addEvent('delivered', step(randInt(rand, 50, 90)))
      if (status === 'cancelled') {
        const cancelAt = step(confirmedBeforeCancel ? 20 : randInt(rand, 2, 12))
        if (confirmedBeforeCancel) {
          for (const { item, product } of items) {
            const cost = item.unit_cost ?? product.cost_price
            product.cost_price = round(
              (product.stock * product.cost_price + item.quantity * cost) /
                (product.stock + item.quantity),
              2,
            )
            product.stock += item.quantity
            db.inventory_movements.push({
              id: id(),
              seller_id: sellerId,
              product_id: product.id,
              delta: item.quantity,
              reason: 'order_cancelled',
              note: null,
              order_id: orderId,
              receipt_id: null,
              unit_cost: cost,
              created_at: cancelAt,
            })
          }
        }
        addEvent('cancelled', cancelAt)
      }
    }

    // Một lần điều chỉnh kho thủ công (kiểm kê phát hiện hàng lỗi).
    const adjusted = sellable.find((p) => p.stock > 5)
    if (adjusted) {
      adjusted.stock -= 2
      db.inventory_movements.push({
        id: id(),
        seller_id: sellerId,
        product_id: adjusted.id,
        delta: -2,
        reason: 'manual_adjust',
        note: 'Kiểm kê: 2 sản phẩm lỗi đường may',
        order_id: null,
        receipt_id: null,
        unit_cost: adjusted.cost_price,
        created_at: at(3, 17),
      })
    }

    if (plan.draftReceipt) {
      const lines = sellable
        .filter((p) => p.is_low_stock || p.stock <= p.low_stock_threshold)
        .slice(0, 3)
        .map((product) => ({ product, qty: 30, cost: round(product.cost_price * 1.05) }))
      if (lines.length > 0) postReceipt(lines, 1, SUPPLIERS[2], 'draft')
    }

    // Thùng rác: sản phẩm đã xóa (khôi phục được trong 30 ngày).
    plan.trash?.forEach((item, index) => {
      const deletedDaysAgo = 5 + index * 7
      const seq = (db.counters.sku[sellerId] ?? 0) + 1
      db.counters.sku[sellerId] = seq
      const productId = id()
      const sku = `DN-${skuNamePart(item.name)}-${String(seq).padStart(3, '0')}`
      const snapshot: Tables<'products'> = {
        id: productId,
        seller_id: sellerId,
        sku,
        name: item.name,
        category_id: null,
        unit: item.unit,
        price: item.price,
        cost_price: item.cost,
        stock: 0,
        low_stock_threshold: item.threshold ?? 10,
        is_low_stock: true,
        is_active: false,
        description: item.description ?? null,
        hero_image_path: null,
        image_paths: [],
        import_id: null,
        created_at: created,
      }
      db.product_trash.push({
        id: productId,
        seller_id: sellerId,
        sku,
        name: item.name,
        category: null,
        unit: item.unit,
        price: item.price,
        cost_price: item.cost,
        stock: 0,
        hero_image_path: null,
        image_paths: [],
        deleted_at: at(deletedDaysAgo, 16),
        purge_at: at(deletedDaysAgo - 30, 16),
        product: snapshot as unknown as Json,
        movements: [] as Json,
      })
    })
  }

  buildShop({
    sellerId: demoShop,
    spanDays: 70,
    orderCount: 120,
    draftReceipt: true,
    categories: [
      {
        name: 'Áo thun',
        items: [
          { name: 'Áo thun basic trắng', unit: 'Cái', price: 149_000, cost: 68_000, qty: 120 },
          { name: 'Áo thun oversize đen', unit: 'Cái', price: 189_000, cost: 88_000, qty: 90 },
          { name: 'Áo polo navy', unit: 'Cái', price: 259_000, cost: 128_000, qty: 60 },
        ],
      },
      {
        name: 'Áo sơ mi',
        items: [
          { name: 'Sơ mi Oxford xanh', unit: 'Cái', price: 329_000, cost: 162_000, qty: 45 },
          { name: 'Sơ mi linen be', unit: 'Cái', price: 359_000, cost: 178_000, qty: 30 },
          {
            name: 'Sơ mi kẻ sọc',
            unit: 'Cái',
            price: 299_000,
            cost: 149_000,
            qty: 14,
            threshold: 8,
          },
        ],
      },
      {
        name: 'Quần',
        items: [
          {
            name: 'Quần jean slim xanh đậm',
            unit: 'Cái',
            price: 459_000,
            cost: 228_000,
            qty: 55,
            description: 'Vải denim co giãn 2 chiều, form slim vừa người.',
          },
          { name: 'Quần kaki ống suông', unit: 'Cái', price: 389_000, cost: 186_000, qty: 40 },
          { name: 'Quần short jean', unit: 'Cái', price: 229_000, cost: 108_000, qty: 12 },
        ],
      },
      {
        name: 'Váy đầm',
        items: [
          { name: 'Đầm hoa nhí', unit: 'Chiếc', price: 399_000, cost: 192_000, qty: 35 },
          { name: 'Chân váy xếp ly', unit: 'Chiếc', price: 279_000, cost: 128_000, qty: 28 },
          { name: 'Đầm suông công sở', unit: 'Chiếc', price: 449_000, cost: 218_000, qty: 6 },
        ],
      },
      {
        name: 'Phụ kiện',
        items: [
          { name: 'Mũ lưỡi trai thêu chữ', unit: 'Cái', price: 129_000, cost: 48_000, qty: 70 },
          { name: 'Túi tote canvas', unit: 'Cái', price: 159_000, cost: 62_000, qty: 50 },
          { name: 'Thắt lưng da bò', unit: 'Cái', price: 249_000, cost: 108_000, qty: 25 },
          { name: 'Tất cổ cao (set 3 đôi)', unit: 'Bộ', price: 79_000, cost: 29_000, qty: 9 },
        ],
      },
    ],
    uncategorized: [
      {
        name: 'Áo khoác gió 2 lớp',
        unit: 'Cái',
        price: 499_000,
        cost: 255_000,
        qty: 20,
        active: false,
      },
    ],
    restock: [
      { name: 'Áo thun basic trắng', qty: 60, cost: 72_000, daysAgo: 30 },
      { name: 'Quần jean slim xanh đậm', qty: 30, cost: 236_000, daysAgo: 24 },
      { name: 'Sơ mi Oxford xanh', qty: 20, cost: 158_000, daysAgo: 12 },
    ],
    trash: [{ name: 'Áo len cổ lọ (mẫu cũ)', unit: 'Cái', price: 299_000, cost: 140_000, qty: 0 }],
  })

  for (const product of db.products) {
    product.is_low_stock = product.stock <= product.low_stock_threshold
  }

  return db
}
