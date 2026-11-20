import { getDemoFileUrl, putDemoFile, removeDemoFiles } from '@/shared/lib/demo/demoFiles'
import {
  DemoDbError,
  SALE_STATUSES,
  dateKeyOf,
  dateKeysBetween,
  logAudit,
  matchesTerm,
  newId,
  nowIso,
  paginate,
  readDemoDb,
  requireAdmin,
  startOfDateKey,
  time,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import { getDemoUserId } from '@/shared/lib/demo/demoSession'
import { canTransitionSeller } from '@/features/sellers'
import { sanitizeFileName } from '@/shared/lib/fileName'
import type {
  AccountFilters,
  AuditFilters,
  DeletionFilters,
  SellerFilters,
} from '../schemas/adminFilters.schema'
import type {
  AccountDeletion,
  AdminAccount,
  AdminSeller,
  AdminSellerDetail,
  AuditLogEntry,
  DeletionEvidence,
  Paged,
  PlatformRevenuePoint,
  PlatformStats,
  SellerDocument,
} from '../types'

/*
 * Backend giả lập (chế độ demo — ADR 011) cho admin.api: cùng quy tắc với các RPC admin
 * (require_admin, kiểm tra state machine, ghi audit_logs trong cùng "transaction").
 */

const DAY_MS = 86_400_000
const NULL_TEXT = null as unknown as string

/** Danh sách có `total_count` ở mỗi dòng như RPC thật, rồi gói lại thành `Paged`. */
function paged<T>(rows: T[], page: number, pageSize: number): Paged<T & { total_count: number }> {
  const { items, total } = paginate(rows, page, pageSize)
  return { items: items.map((row) => ({ ...row, total_count: total })), total }
}

const emailOf = (db: DemoDb, userId: string | null) =>
  db.users.find((u) => u.id === userId)?.email ?? null

function requireReason(reason: string): string {
  const clean = reason.trim()
  if (clean.length === 0 || clean.length > 1000) throw new DemoDbError('REASON_REQUIRED')
  return clean
}

const sinceMs = (days: number) => Date.now() - Math.min(Math.max(days, 1), 366) * DAY_MS

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

export async function fetchPlatformStats(days: number): Promise<PlatformStats> {
  const db = await readDemoDb()
  requireAdmin(db)
  const since = sinceMs(days)
  const countStatus = (status: string) => db.sellers.filter((s) => s.status === status).length
  const sales = db.orders.filter((o) => SALE_STATUSES.has(o.status))
  const live = db.orders.filter((o) => o.status !== 'cancelled')
  return {
    draft_count: countStatus('draft'),
    pending_count: countStatus('pending'),
    approved_count: countStatus('approved'),
    rejected_count: countStatus('rejected'),
    suspended_count: countStatus('suspended'),
    total_revenue: sales.reduce((sum, o) => sum + o.total, 0),
    period_revenue: sales
      .filter((o) => time(o.created_at) >= since)
      .reduce((sum, o) => sum + o.total, 0),
    total_orders: live.length,
    period_orders: live.filter((o) => time(o.created_at) >= since).length,
    total_accounts: db.profiles.length,
    new_accounts: db.profiles.filter((p) => time(p.created_at) >= since).length,
    locked_accounts: db.profiles.filter((p) => p.is_locked && p.account_status === 'active').length,
    pending_deletion_count: db.account_deletions.filter((d) => d.status === 'pending').length,
  }
}

export async function fetchPlatformRevenue(days: number): Promise<PlatformRevenuePoint[]> {
  const db = await readDemoDb()
  requireAdmin(db)
  const n = Math.min(Math.max(days, 1), 366)
  const today = startOfDateKey(dateKeyOf(Date.now()))
  const points = new Map<string, PlatformRevenuePoint>(
    dateKeysBetween(today - (n - 1) * DAY_MS, today).map((day) => [
      day,
      { day, revenue: 0, orders: 0 },
    ]),
  )
  for (const order of db.orders) {
    const point = points.get(dateKeyOf(order.created_at))
    if (!point) continue
    if (SALE_STATUSES.has(order.status)) point.revenue += order.total
    if (order.status !== 'cancelled') point.orders += 1
  }
  return [...points.values()]
}

export async function fetchAccounts(filters: AccountFilters): Promise<Paged<AdminAccount>> {
  const db = await readDemoDb()
  requireAdmin(db)
  const q = filters.q.trim()
  const rows = db.profiles
    .map((p) => {
      const user = db.users.find((u) => u.id === p.id)
      const seller = db.sellers.find((s) => s.owner_id === p.id)
      return {
        id: p.id,
        email: user?.email ?? '',
        full_name: p.full_name ?? NULL_TEXT,
        phone: p.phone ?? NULL_TEXT,
        role: p.role,
        is_locked: p.is_locked,
        locked_reason: p.locked_reason ?? NULL_TEXT,
        account_status: p.account_status,
        created_at: p.created_at,
        last_sign_in_at: user?.last_sign_in_at ?? NULL_TEXT,
        email_confirmed: user?.last_sign_in_at !== null,
        seller_id: seller?.id ?? NULL_TEXT,
        seller_status: seller?.status ?? (null as unknown as AdminAccount['seller_status']),
        shop_name: seller?.shop_name ?? NULL_TEXT,
      }
    })
    .filter((a) => {
      const notDeleted = filters.state === 'active' || filters.state === 'locked'
      return (
        (filters.role === 'all' || a.role === filters.role) &&
        (!notDeleted ||
          (a.account_status === 'active' && a.is_locked === (filters.state === 'locked'))) &&
        (filters.state !== 'pending_deletion' || a.account_status === 'pending_deletion') &&
        matchesTerm(q, a.email, a.full_name, a.shop_name, a.phone)
      )
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
  return paged(rows, filters.page, filters.pageSize)
}

function toAdminSeller(db: DemoDb, sellerId: string): Omit<AdminSeller, 'total_count'> | null {
  const s = db.sellers.find((seller) => seller.id === sellerId)
  if (!s) return null
  const profile = db.profiles.find((p) => p.id === s.owner_id)
  const orders = db.orders.filter((o) => o.seller_id === s.id)
  return {
    id: s.id,
    shop_name: s.shop_name ?? NULL_TEXT,
    business_name: s.business_name ?? NULL_TEXT,
    status: s.status,
    owner_id: s.owner_id ?? NULL_TEXT,
    owner_email: emailOf(db, s.owner_id) ?? s.former_owner_email ?? NULL_TEXT,
    is_locked: profile?.is_locked ?? false,
    account_status: profile?.account_status ?? 'deleted',
    created_at: s.created_at,
    submitted_at: s.submitted_at ?? NULL_TEXT,
    reviewed_at: s.reviewed_at ?? NULL_TEXT,
    product_count: db.products.filter((p) => p.seller_id === s.id).length,
    order_count: orders.filter((o) => o.status !== 'cancelled').length,
    revenue: orders.filter((o) => SALE_STATUSES.has(o.status)).reduce((sum, o) => sum + o.total, 0),
  }
}

export async function fetchSellers(filters: SellerFilters): Promise<Paged<AdminSeller>> {
  const db = await readDemoDb()
  requireAdmin(db)
  const q = filters.q.trim()
  const rows = db.sellers
    .filter(
      (s) =>
        (filters.status === 'all' || s.status === filters.status) &&
        matchesTerm(
          q,
          s.shop_name,
          s.business_name,
          emailOf(db, s.owner_id) ?? s.former_owner_email,
          s.tax_code,
        ),
    )
    .sort((a, b) =>
      filters.status === 'pending'
        ? (a.submitted_at ?? '').localeCompare(b.submitted_at ?? '')
        : b.created_at.localeCompare(a.created_at),
    )
    .flatMap((s) => toAdminSeller(db, s.id) ?? [])
  return paged(rows, filters.page, filters.pageSize)
}

export async function fetchSellerDetail(sellerId: string): Promise<AdminSellerDetail | null> {
  const db = await readDemoDb()
  requireAdmin(db)
  const s = db.sellers.find((seller) => seller.id === sellerId)
  if (!s) return null
  const profile = db.profiles.find((p) => p.id === s.owner_id)
  return {
    id: s.id,
    shop_name: s.shop_name ?? NULL_TEXT,
    slug: s.slug ?? NULL_TEXT,
    status: s.status,
    business_type: s.business_type ?? (null as unknown as AdminSellerDetail['business_type']),
    business_name: s.business_name ?? NULL_TEXT,
    tax_code: s.tax_code ?? NULL_TEXT,
    license_number: s.license_number ?? NULL_TEXT,
    address: s.address ?? NULL_TEXT,
    representative_name: s.representative_name ?? NULL_TEXT,
    representative_phone: s.representative_phone ?? NULL_TEXT,
    contact_email: s.contact_email ?? NULL_TEXT,
    main_category: s.main_category ?? NULL_TEXT,
    owner_id: s.owner_id ?? NULL_TEXT,
    owner_email: emailOf(db, s.owner_id) ?? s.former_owner_email ?? NULL_TEXT,
    owner_full_name: profile?.full_name ?? s.former_owner_name ?? NULL_TEXT,
    is_locked: profile?.is_locked ?? false,
    locked_reason: profile?.locked_reason ?? NULL_TEXT,
    account_status: profile?.account_status ?? 'deleted',
    rejection_reason: s.rejection_reason ?? NULL_TEXT,
    suspended_reason: s.suspended_reason ?? NULL_TEXT,
    submitted_at: s.submitted_at ?? NULL_TEXT,
    reviewed_at: s.reviewed_at ?? NULL_TEXT,
    reviewer_email: emailOf(db, s.reviewed_by) ?? NULL_TEXT,
    terms_version: s.terms_version ?? NULL_TEXT,
    terms_accepted_at: s.terms_accepted_at ?? NULL_TEXT,
    created_at: s.created_at,
  }
}

export async function fetchSellerDocuments(sellerId: string): Promise<SellerDocument[]> {
  const db = await readDemoDb()
  requireAdmin(db)
  return db.seller_documents
    .filter((d) => d.seller_id === sellerId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function auditLabel(db: DemoDb, targetType: string, targetId: string, email: unknown) {
  if (targetType === 'seller') return db.sellers.find((s) => s.id === targetId)?.shop_name ?? null
  if (targetType === 'account') {
    return (
      emailOf(db, targetId) ??
      db.account_deletions.find((d) => d.former_user_id === targetId && d.email)?.email ??
      (typeof email === 'string' ? email : null)
    )
  }
  return null
}

export async function fetchAuditLogs(
  filters: AuditFilters & { targetIds?: readonly string[] },
): Promise<Paged<AuditLogEntry>> {
  const db = await readDemoDb()
  requireAdmin(db)
  const from = filters.from ? startOfDateKey(filters.from) : -Infinity
  const to = filters.to ? startOfDateKey(filters.to) + DAY_MS : Infinity
  const rows = db.audit_logs
    .filter(
      (a) =>
        (!filters.actor || a.actor_id === filters.actor) &&
        (!filters.action || a.action === filters.action) &&
        (!filters.targetIds || filters.targetIds.includes(a.target_id)) &&
        time(a.created_at) >= from &&
        time(a.created_at) < to,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
    .map((a) => {
      const metadata = a.metadata as Record<string, unknown> | null
      return {
        id: a.id,
        created_at: a.created_at,
        actor_id: a.actor_id ?? NULL_TEXT,
        actor_email: emailOf(db, a.actor_id) ?? NULL_TEXT,
        action: a.action,
        target_type: a.target_type,
        target_id: a.target_id,
        target_label: auditLabel(db, a.target_type, a.target_id, metadata?.email) ?? NULL_TEXT,
        metadata: a.metadata,
      }
    })
  return paged(rows, filters.page, filters.pageSize)
}

export async function fetchDeletions(filters: DeletionFilters): Promise<Paged<AccountDeletion>> {
  const db = await readDemoDb()
  requireAdmin(db)
  const q = filters.q.trim()
  const rows = db.account_deletions
    .filter(
      (d) =>
        (filters.status === 'all' || d.status === filters.status) &&
        matchesTerm(q, d.email, d.full_name, d.shop_name),
    )
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at) || a.id.localeCompare(b.id))
    .map((d) => ({
      id: d.id,
      user_id: d.user_id ?? NULL_TEXT,
      email: d.email ?? NULL_TEXT,
      full_name: d.full_name ?? NULL_TEXT,
      role: db.profiles.find((p) => p.id === d.user_id)?.role ?? 'seller',
      seller_id: d.seller_id ?? NULL_TEXT,
      shop_name: d.shop_name ?? NULL_TEXT,
      reason: d.reason,
      status: d.status,
      requested_at: d.requested_at,
      requested_by_email: emailOf(db, d.requested_by) ?? NULL_TEXT,
      evidence_count: db.account_deletion_evidence.filter((e) => e.deletion_id === d.id).length,
      confirmed_at: d.confirmed_at ?? NULL_TEXT,
      restored_at: d.restored_at ?? NULL_TEXT,
      restore_note: d.restore_note ?? NULL_TEXT,
      notified_at: d.notified_at ?? NULL_TEXT,
      notify_error: d.notify_error ?? NULL_TEXT,
    }))
  return paged(rows, filters.page, filters.pageSize)
}

export async function fetchDeletionEvidence(deletionId: string): Promise<DeletionEvidence[]> {
  const db = await readDemoDb()
  requireAdmin(db)
  return db.account_deletion_evidence
    .filter((e) => e.deletion_id === deletionId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function createSignedFileUrl(_bucket: string, path: string): Promise<string> {
  return getDemoFileUrl(path)
}

// -----------------------------------------------------------------------------
// Hành động — đều ghi audit_logs
// -----------------------------------------------------------------------------

export async function reviewSeller(
  sellerId: string,
  decision: 'approved' | 'rejected',
  reason: string,
): Promise<void> {
  return writeDemoDb((db) => {
    requireAdmin(db)
    const seller = db.sellers.find((s) => s.id === sellerId)
    if (!seller) throw new DemoDbError('SELLER_NOT_FOUND')
    if (seller.status !== 'pending') throw new DemoDbError('SELLER_NOT_PENDING', seller.status)
    const cleanReason = decision === 'rejected' ? requireReason(reason) : reason.trim() || null
    Object.assign(seller, {
      status: decision,
      rejection_reason: decision === 'rejected' ? cleanReason : null,
      reviewed_by: getDemoUserId(),
      reviewed_at: nowIso(),
      updated_at: nowIso(),
    })
    logAudit(db, `seller.${decision}`, 'seller', sellerId, { from: 'pending', reason: cleanReason })
  })
}

export async function setSellerSuspended(
  sellerId: string,
  suspended: boolean,
  reason: string,
): Promise<void> {
  return writeDemoDb((db) => {
    requireAdmin(db)
    const seller = db.sellers.find((s) => s.id === sellerId)
    if (!seller) throw new DemoDbError('SELLER_NOT_FOUND')
    const to = suspended ? 'suspended' : 'approved'
    if (!canTransitionSeller(seller.status, to)) {
      throw new DemoDbError('INVALID_SELLER_TRANSITION', `${seller.status} -> ${to}`)
    }
    const from = seller.status
    const cleanReason = suspended ? requireReason(reason) : reason.trim() || null
    Object.assign(seller, {
      status: to,
      suspended_reason: suspended ? cleanReason : null,
      updated_at: nowIso(),
    })
    logAudit(db, suspended ? 'seller.suspended' : 'seller.unsuspended', 'seller', sellerId, {
      from,
      reason: cleanReason,
    })
  })
}

function targetProfile(db: DemoDb, userId: string) {
  const profile = db.profiles.find((p) => p.id === userId)
  if (!profile) throw new DemoDbError('ACCOUNT_NOT_FOUND')
  return profile
}

export async function setAccountLocked(
  userId: string,
  locked: boolean,
  reason: string,
): Promise<void> {
  return writeDemoDb((db) => {
    requireAdmin(db)
    if (userId === getDemoUserId()) throw new DemoDbError('CANNOT_LOCK_SELF')
    const profile = targetProfile(db, userId)
    if (profile.role === 'admin') throw new DemoDbError('CANNOT_LOCK_ADMIN')
    if (profile.account_status !== 'active') throw new DemoDbError('ACCOUNT_PENDING_DELETION')
    const cleanReason = locked ? requireReason(reason) : reason.trim() || null
    Object.assign(profile, {
      is_locked: locked,
      locked_reason: locked ? cleanReason : null,
      locked_at: locked ? nowIso() : null,
    })
    logAudit(db, locked ? 'account.locked' : 'account.unlocked', 'account', userId, {
      reason: cleanReason,
    })
  })
}

export async function requestAccountDeletion(
  userId: string,
  reason: string,
  evidence: readonly File[],
): Promise<string> {
  if (evidence.length > 10) throw new DemoDbError('TOO_MANY_EVIDENCE')
  const uploaded = await Promise.all(
    evidence.map(async (file) => {
      const path = `${userId}/${newId()}-${sanitizeFileName(file.name)}`
      await putDemoFile(path, file)
      return { path, file }
    }),
  )
  try {
    return await writeDemoDb((db) => {
      requireAdmin(db)
      if (userId === getDemoUserId()) throw new DemoDbError('CANNOT_DELETE_SELF')
      const profile = targetProfile(db, userId)
      if (profile.role === 'admin') throw new DemoDbError('CANNOT_DELETE_ADMIN')
      if (profile.account_status !== 'active') {
        throw new DemoDbError('ACCOUNT_NOT_ACTIVE', profile.account_status)
      }
      const cleanReason = requireReason(reason)
      const seller = db.sellers.find((s) => s.owner_id === userId)
      const email = emailOf(db, userId)
      const deletionId = newId()
      const now = nowIso()
      db.account_deletions.push({
        id: deletionId,
        user_id: userId,
        former_user_id: userId,
        email,
        full_name: profile.full_name,
        seller_id: seller?.id ?? null,
        shop_name: seller?.shop_name ?? null,
        reason: cleanReason,
        requested_at: now,
        requested_by: getDemoUserId(),
        previous_locked: profile.is_locked,
        previous_locked_reason: profile.locked_reason,
        previous_locked_at: profile.locked_at,
        status: 'pending',
        confirmed_at: null,
        confirmed_by: null,
        restored_at: null,
        restored_by: null,
        restore_note: null,
        notified_at: null,
        notify_error: null,
      })
      for (const { path, file } of uploaded) {
        db.account_deletion_evidence.push({
          id: newId(),
          deletion_id: deletionId,
          storage_path: path,
          file_name: file.name.slice(0, 255) || 'bang-chung',
          mime_type: file.type,
          file_size: file.size,
          created_at: now,
        })
      }
      Object.assign(profile, {
        account_status: 'pending_deletion',
        is_locked: true,
        locked_reason: cleanReason,
        locked_at: profile.locked_at ?? now,
      })
      logAudit(db, 'account.deletion_requested', 'account', userId, {
        deletion_id: deletionId,
        reason: cleanReason,
        evidence_count: uploaded.length,
        seller_id: seller?.id ?? null,
        email,
        shop_name: seller?.shop_name ?? null,
      })
      return deletionId
    })
  } catch (error) {
    removeDemoFiles(uploaded.map((u) => u.path))
    throw error
  }
}

/** Demo không gửi email thật: chỉ đánh dấu đã thông báo. */
export async function notifyAccountDeletion(deletionId: string): Promise<void> {
  return writeDemoDb((db) => {
    requireAdmin(db)
    const deletion = db.account_deletions.find((d) => d.id === deletionId)
    if (!deletion) throw new DemoDbError('DELETION_NOT_FOUND')
    deletion.notified_at = nowIso()
    deletion.notify_error = null
  })
}

function pendingDeletion(db: DemoDb, deletionId: string, notPendingCode: string) {
  const deletion = db.account_deletions.find((d) => d.id === deletionId)
  if (!deletion) throw new DemoDbError('DELETION_NOT_FOUND')
  if (deletion.status !== 'pending' || !deletion.user_id) {
    throw new DemoDbError(notPendingCode, deletion.status)
  }
  return { deletion, userId: deletion.user_id }
}

/** Xóa tài khoản đăng nhập, GIỮ shop + dữ liệu kinh doanh (như RPC thật — ADR 010). */
export async function confirmAccountDeletion(deletionId: string): Promise<void> {
  return writeDemoDb((db) => {
    requireAdmin(db)
    const { deletion, userId } = pendingDeletion(db, deletionId, 'DELETION_NOT_PENDING')
    const email = emailOf(db, userId) ?? deletion.email
    const profile = db.profiles.find((p) => p.id === userId)
    const now = nowIso()
    for (const seller of db.sellers.filter((s) => s.owner_id === userId)) {
      Object.assign(seller, {
        owner_id: null,
        former_owner_id: userId,
        former_owner_email: email,
        former_owner_name: profile?.full_name ?? deletion.full_name,
        owner_removed_at: now,
      })
    }
    Object.assign(deletion, {
      status: 'confirmed',
      confirmed_by: getDemoUserId(),
      confirmed_at: now,
      email,
      user_id: null,
    })
    logAudit(db, 'account.deletion_confirmed', 'account', userId, {
      deletion_id: deletionId,
      email,
      shop_name: deletion.shop_name,
    })
    db.users = db.users.filter((u) => u.id !== userId)
    db.profiles = db.profiles.filter((p) => p.id !== userId)
    db.activity_logs = db.activity_logs.filter((a) => a.user_id !== userId)
  })
}

export async function restoreAccount(deletionId: string, note: string): Promise<void> {
  return writeDemoDb((db) => {
    requireAdmin(db)
    const { deletion, userId } = pendingDeletion(db, deletionId, 'DELETION_NOT_RESTORABLE')
    const cleanNote = note.trim().slice(0, 1000) || null
    Object.assign(deletion, {
      status: 'restored',
      restored_by: getDemoUserId(),
      restored_at: nowIso(),
      restore_note: cleanNote,
    })
    const profile = db.profiles.find((p) => p.id === userId)
    if (profile) {
      Object.assign(profile, {
        account_status: 'active',
        is_locked: deletion.previous_locked,
        locked_reason: deletion.previous_locked ? deletion.previous_locked_reason : null,
        locked_at: deletion.previous_locked ? (deletion.previous_locked_at ?? nowIso()) : null,
      })
    }
    logAudit(db, 'account.deletion_restored', 'account', userId, {
      deletion_id: deletionId,
      note: cleanNote,
    })
  })
}
