import type { Json, Tables } from '@/shared/types/database.types'
import { getDemoUserId } from './demoSession'

/**
 * "Database" của chế độ demo: các bảng giống schema Postgres (dùng type sinh từ Supabase), lưu
 * nguyên khối JSON trong `sessionStorage` của tab. Đóng tab là mất; tải lại trang vẫn giữ.
 */
export interface DemoUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

export interface DemoDb {
  version: number
  users: DemoUser[]
  profiles: Tables<'profiles'>[]
  sellers: Tables<'sellers'>[]
  categories: Tables<'categories'>[]
  products: Tables<'products'>[]
  orders: Tables<'orders'>[]
  order_items: Tables<'order_items'>[]
  order_status_events: Tables<'order_status_events'>[]
  customers: Tables<'customers'>[]
  inventory_movements: Tables<'inventory_movements'>[]
  purchase_receipts: Tables<'purchase_receipts'>[]
  purchase_receipt_items: Tables<'purchase_receipt_items'>[]
  product_imports: Tables<'product_imports'>[]
  product_trash: Tables<'product_trash'>[]
  seller_documents: Tables<'seller_documents'>[]
  audit_logs: Tables<'audit_logs'>[]
  account_deletions: Tables<'account_deletions'>[]
  account_deletion_evidence: Tables<'account_deletion_evidence'>[]
  activity_logs: Tables<'activity_logs'>[]
  /** Bộ đếm mã chứng từ theo shop (DH-000001, PN-000001, STT trong SKU). */
  counters: Record<'order' | 'receipt' | 'sku', Record<string, number>>
}

/** Đổi khi cấu trúc dữ liệu mẫu đổi: dữ liệu cũ trong tab bị bỏ, tạo lại từ seed. */
export const DEMO_DB_VERSION = 1
const STORAGE_KEY = 'sellerops.demo.db'

let cache: DemoDb | null = null

function readStored(): DemoDb | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoDb
    return parsed.version === DEMO_DB_VERSION ? parsed : null
  } catch {
    return null
  }
}

function persist(db: DemoDb): void {
  for (const product of db.products) {
    product.is_low_stock = product.stock <= product.low_stock_threshold
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Hết dung lượng / bị chặn: dữ liệu vẫn sống trong bộ nhớ tới khi tải lại trang.
  }
}

/** Độ trễ nhỏ để skeleton / trạng thái loading hiện giống khi gọi mạng thật. */
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 120
const latency = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS))

async function load(): Promise<DemoDb> {
  if (cache) return cache
  const stored = readStored()
  if (stored) {
    cache = stored
    return stored
  }
  const { createSeedDb } = await import('./demoSeed')
  const seeded = createSeedDb(new Date())
  persist(seeded)
  cache = seeded
  return seeded
}

/** Đọc dữ liệu (không sửa). */
export async function readDemoDb(): Promise<DemoDb> {
  await latency()
  return load()
}

/**
 * Ghi như một transaction: hàm chạy trên bản sao, ném lỗi giữa chừng thì không có gì thay đổi
 * (giống RPC Postgres rollback khi `raise exception`).
 */
export async function writeDemoDb<T>(change: (db: DemoDb) => T): Promise<T> {
  await latency()
  const draft = structuredClone(await load())
  const result = change(draft)
  persist(draft)
  cache = draft
  return result
}

/** Dữ liệu đã nạp (đồng bộ) — cho hàm không async như ghép URL ảnh. `null` nếu chưa nạp. */
export function peekDemoDb(): DemoDb | null {
  return cache
}

/** Xóa dữ liệu demo của tab: lần đọc sau tạo lại từ seed. */
export function resetDemoDb(): void {
  cache = null
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Bỏ qua.
  }
}

// -----------------------------------------------------------------------------
// Lỗi giống RPC: `message` là mã nghiệp vụ, feature map sang tiếng Việt như với Postgres.
// -----------------------------------------------------------------------------

export class DemoDbError extends Error {
  readonly code: string
  readonly details: string | null

  constructor(message: string, details: string | null = null, code = 'P0001') {
    super(message)
    this.name = 'DemoDbError'
    this.code = code
    this.details = details
  }
}

// -----------------------------------------------------------------------------
// Tiện ích truy vấn
// -----------------------------------------------------------------------------

export const newId = (): string => crypto.randomUUID()
export const nowIso = (): string => new Date().toISOString()

export const SALE_STATUSES: ReadonlySet<Tables<'orders'>['status']> = new Set([
  'confirmed',
  'shipping',
  'delivered',
])

/** Như `ilike '%term%'` trên nhiều cột (term đã qua `toSearchTerm`). */
export function matchesTerm(term: string, ...fields: Array<string | null | undefined>): boolean {
  if (!term) return true
  const key = term.toLowerCase()
  return fields.some((field) => field?.toLowerCase().includes(key))
}

type Sortable = string | number | boolean | null | undefined

/** Sắp xếp ổn định theo một cột, khóa phụ `id` tăng dần (như `.order(col).order('id')`). */
export function sortRows<T extends { id: string }>(
  rows: readonly T[],
  pick: (row: T) => Sortable,
  ascending: boolean,
): T[] {
  return [...rows].sort((a, b) => {
    const x = pick(a)
    const y = pick(b)
    if (x !== y) {
      // Postgres: NULL lớn nhất (ASC → cuối, DESC → đầu).
      if (x === null || x === undefined) return ascending ? 1 : -1
      if (y === null || y === undefined) return ascending ? -1 : 1
      const diff =
        typeof x === 'string' && typeof y === 'string'
          ? x.localeCompare(y, 'vi')
          : Number(x) - Number(y)
      if (diff !== 0) return ascending ? diff : -diff
    }
    return a.id.localeCompare(b.id)
  })
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const from = (page - 1) * pageSize
  return { items: rows.slice(from, from + pageSize), total: rows.length }
}

/** Bỏ dấu + gộp khoảng trắng + chữ thường (như `normalize_product_name`). */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

// -----------------------------------------------------------------------------
// Ngày giờ theo giờ Việt Nam (UTC+7, không có giờ mùa hè) — như `report_bounds`
// -----------------------------------------------------------------------------

const VN_OFFSET = '+07:00'
const DAY_MS = 86_400_000

export const startOfDateKey = (key: string): number => Date.parse(`${key}T00:00:00${VN_OFFSET}`)

export function dateKeyOf(iso: string | number): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

export function reportBounds(from: string, to: string) {
  const start = startOfDateKey(from)
  const end = startOfDateKey(to) + DAY_MS
  if (!(start < end) || (end - start) / DAY_MS > 366) throw new DemoDbError('INVALID_RANGE')
  return { start, end, prevStart: start - (end - start) }
}

/** Mốc bắt đầu của "N ngày gần nhất" (tính cả hôm nay) — như `dashboard_range_start`. */
export function dashboardRangeStart(days: number, now = Date.now()): number {
  if (days < 1 || days > 366) throw new DemoDbError('INVALID_RANGE')
  return startOfDateKey(dateKeyOf(now)) - (days - 1) * DAY_MS
}

export function dateKeysBetween(fromMs: number, toMs: number): string[] {
  const keys: string[] = []
  for (let t = fromMs; t <= toMs; t += DAY_MS) keys.push(dateKeyOf(t))
  return keys
}

export const time = (iso: string): number => Date.parse(iso)

// -----------------------------------------------------------------------------
// Phân quyền — tương đương require_admin / require_approved_seller / resolve_report_seller
// -----------------------------------------------------------------------------

export function currentProfile(db: DemoDb): Tables<'profiles'> {
  const userId = getDemoUserId()
  const profile = db.profiles.find((p) => p.id === userId)
  if (!profile) throw new DemoDbError('NOT_AUTHENTICATED')
  if (profile.is_locked) throw new DemoDbError('ACCOUNT_LOCKED')
  return profile
}

export function requireAdmin(db: DemoDb): Tables<'profiles'> {
  const profile = currentProfile(db)
  if (profile.role !== 'admin') throw new DemoDbError('NOT_ADMIN')
  return profile
}

export function ownSeller(db: DemoDb): Tables<'sellers'> | undefined {
  const userId = getDemoUserId()
  return db.sellers.find((s) => s.owner_id === userId)
}

/** Seller đang đăng nhập, shop đã duyệt và tài khoản không khóa; trả về id shop. */
export function requireApprovedSeller(db: DemoDb): string {
  currentProfile(db)
  const seller = ownSeller(db)
  if (!seller) throw new DemoDbError('SELLER_NOT_FOUND')
  if (seller.status !== 'approved') throw new DemoDbError('SELLER_NOT_APPROVED')
  return seller.id
}

/** Shop được xem báo cáo: admin xem shop được chọn; seller chỉ xem shop mình. */
export function resolveReportSeller(db: DemoDb, sellerId: string | null | undefined): string {
  const profile = currentProfile(db)
  if (profile.role === 'admin') {
    if (!sellerId) throw new DemoDbError('SELLER_NOT_FOUND')
    return sellerId
  }
  const own = requireApprovedSeller(db)
  if (sellerId && sellerId !== own) throw new DemoDbError('FORBIDDEN')
  return own
}

export function logAudit(
  db: DemoDb,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, Json | undefined> = {},
): void {
  db.audit_logs.push({
    id: newId(),
    actor_id: getDemoUserId(),
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata as Json,
    created_at: nowIso(),
  })
}

export function nextCounter(db: DemoDb, kind: keyof DemoDb['counters'], sellerId: string): number {
  const next = (db.counters[kind][sellerId] ?? 0) + 1
  db.counters[kind][sellerId] = next
  return next
}

export const padCode = (prefix: string, value: number, width = 6): string =>
  `${prefix}-${String(value).padStart(width, '0')}`
