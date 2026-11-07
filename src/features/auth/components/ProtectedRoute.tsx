import { Navigate, Outlet, useLocation } from 'react-router'
import { PageLoader } from '@/shared/components/PageLoader'
import { ROUTES } from '@/shared/constants/routes'
import { useAuthStatus } from '../hooks/useAuth'
import type { LoginRedirectState } from '../lib/redirect'

/** Chỉ render route con khi đã đăng nhập; nếu chưa, chuyển sang /login và nhớ trang đang mở. */
export function ProtectedRoute() {
  const status = useAuthStatus()
  const { pathname, search } = useLocation()

  if (status === 'loading') return <PageLoader />

  if (status === 'unauthenticated') {
    const state: LoginRedirectState = { from: { pathname, search } }
    return <Navigate to={ROUTES.login} replace state={state} />
  }

  return <Outlet />
}
