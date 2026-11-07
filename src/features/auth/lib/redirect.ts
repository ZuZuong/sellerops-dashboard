import { ROUTES } from '@/shared/constants/routes'

/** State mà ProtectedRoute gắn vào khi chuyển hướng sang trang đăng nhập. */
export interface LoginRedirectState {
  from: { pathname: string; search: string }
}

/**
 * Lấy đường dẫn cần quay lại sau khi đăng nhập từ `location.state`.
 * State đến từ history nên không tin cậy kiểu — kiểm tra từng trường.
 */
export function getRedirectPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return ROUTES.dashboard
  }
  const { from } = state
  if (typeof from !== 'object' || from === null || !('pathname' in from)) {
    return ROUTES.dashboard
  }
  const { pathname } = from
  // Chỉ chấp nhận đường dẫn nội bộ, tránh vòng lặp quay lại /login.
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return ROUTES.dashboard
  }
  if (pathname === ROUTES.login) return ROUTES.dashboard

  const search = 'search' in from && typeof from.search === 'string' ? from.search : ''
  return pathname + search
}
