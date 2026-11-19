import { ROUTES } from '@/shared/constants/routes'

/** State mà ProtectedRoute gắn vào khi chuyển hướng sang trang đăng nhập. */
export interface LoginRedirectState {
  from: { pathname: string; search: string }
}

/** Trang dành cho khách: quay lại đó sau khi đăng nhập sẽ bị đẩy ra ngay → bỏ qua. */
const GUEST_PATHS: readonly string[] = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.verifyEmail,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
]

/**
 * Lấy đường dẫn cần quay lại sau khi đăng nhập từ `location.state`; mặc định `/` (tự chuyển
 * hướng theo vai trò). State đến từ history nên không tin cậy kiểu — kiểm tra từng trường.
 */
export function getRedirectPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return ROUTES.home
  }
  const { from } = state
  if (typeof from !== 'object' || from === null || !('pathname' in from)) {
    return ROUTES.home
  }
  const { pathname } = from
  // Chỉ chấp nhận đường dẫn nội bộ, tránh vòng lặp quay lại trang khách.
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return ROUTES.home
  }
  if (GUEST_PATHS.includes(pathname)) return ROUTES.home

  const search = 'search' in from && typeof from.search === 'string' ? from.search : ''
  return pathname + search
}
