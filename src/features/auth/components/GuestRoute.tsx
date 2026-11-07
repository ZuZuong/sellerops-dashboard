import { Navigate, Outlet, useLocation } from 'react-router'
import { PageLoader } from '@/shared/components/PageLoader'
import { useAuthStatus } from '../hooks/useAuth'
import { getRedirectPath } from '../lib/redirect'

/** Route chỉ dành cho khách (vd. /login); đã đăng nhập thì quay về trang trước đó. */
export function GuestRoute() {
  const status = useAuthStatus()
  const location = useLocation()

  if (status === 'loading') return <PageLoader />

  if (status === 'authenticated') {
    return <Navigate to={getRedirectPath(location.state)} replace />
  }

  return <Outlet />
}
