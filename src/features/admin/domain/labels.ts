import type { AccountStatus, DeletionStatus, UserRole } from '../types'

export const ROLE_META: Readonly<Record<UserRole, { label: string; color: string }>> = {
  admin: { label: 'Quản trị', color: 'grape' },
  seller: { label: 'Người bán', color: 'indigo' },
  customer: { label: 'Người mua', color: 'gray' },
}

export const ACCOUNT_STATUS_META: Readonly<
  Record<AccountStatus, { label: string; color: string }>
> = {
  active: { label: 'Hoạt động', color: 'green' },
  pending_deletion: { label: 'Chờ xác nhận xóa', color: 'orange' },
  deleted: { label: 'Đã xóa', color: 'dark' },
}

export const DELETION_STATUS_META: Readonly<
  Record<DeletionStatus, { label: string; color: string }>
> = {
  pending: { label: 'Chờ xác nhận', color: 'orange' },
  confirmed: { label: 'Đã xóa', color: 'dark' },
  restored: { label: 'Đã khôi phục', color: 'green' },
}

/** Tên hành động trong audit_logs (khớp các RPC ghi log). */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  'seller.submitted': 'Gửi hồ sơ',
  'seller.approved': 'Duyệt hồ sơ',
  'seller.rejected': 'Từ chối hồ sơ',
  'seller.suspended': 'Tạm khóa shop',
  'seller.unsuspended': 'Mở khóa shop',
  'account.locked': 'Khóa tài khoản',
  'account.unlocked': 'Mở khóa tài khoản',
  'account.deletion_requested': 'Xóa tài khoản',
  'account.deletion_confirmed': 'Xác nhận xóa tài khoản',
  'account.deletion_restored': 'Khôi phục tài khoản',
}

export const auditActionLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}))

/** Trạng thái hiển thị của một tài khoản (ưu tiên xóa > khóa > hoạt động). */
export function accountStateOf(account: { account_status: AccountStatus; is_locked: boolean }): {
  label: string
  color: string
} {
  if (account.account_status !== 'active') return ACCOUNT_STATUS_META[account.account_status]
  return account.is_locked ? { label: 'Bị khóa', color: 'red' } : ACCOUNT_STATUS_META.active
}

/** Lý do trong metadata của audit log (nếu có). */
export function auditReason(metadata: unknown): string | null {
  if (typeof metadata !== 'object' || metadata === null) return null
  const record = metadata as Record<string, unknown>
  const value = record.reason ?? record.note
  return typeof value === 'string' && value.length > 0 ? value : null
}
