import { ROUTES } from '@/shared/constants/routes'
import type { Enums } from '@/shared/types/database.types'

export type UserRole = Enums<'user_role'>

/**
 * Tài khoản đang đăng nhập — đọc từ bảng `profiles` (KHÔNG từ user_metadata / app_metadata:
 * hai chỗ đó client tự ghi được hoặc không phản ánh quyền thật trong RLS).
 */
export interface Account {
  id: string
  email: string
  role: UserRole
  fullName: string | null
  isLocked: boolean
  lockedReason: string | null
}

/** Trang chủ theo vai trò sau khi đăng nhập. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return ROUTES.admin
    case 'seller':
      return ROUTES.dashboard
    case 'customer':
      return ROUTES.noAccess
  }
}

export type RoleAccess = { kind: 'allowed' } | { kind: 'locked' } | { kind: 'redirect'; to: string }

/**
 * Quyết định vào route của nhóm `allowed`: tài khoản khóa → màn hình khóa; sai vai trò →
 * chuyển về trang chủ của vai trò đó. Chỉ phục vụ UX — RLS / RPC mới là lớp chặn thật.
 */
export function resolveRoleAccess(account: Account, allowed: readonly UserRole[]): RoleAccess {
  if (account.isLocked) return { kind: 'locked' }
  if (allowed.includes(account.role)) return { kind: 'allowed' }
  return { kind: 'redirect', to: homePathForRole(account.role) }
}

/** Đánh dấu tài khoản đăng ký từ trang đăng ký seller (xem `ensureSellerRegistration`). */
export const SIGNUP_INTENT_KEY = 'signup_intent'
export const SELLER_SIGNUP_INTENT = 'seller'
