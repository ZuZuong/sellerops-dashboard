import { Navigate, Outlet } from 'react-router'
import { PageLoader } from '@/shared/components/PageLoader'
import { useAccount } from '../api/auth.queries'
import { homePathForRole, resolveRoleAccess, type UserRole } from '../domain/account'

interface RoleGuardProps {
  allow: readonly UserRole[]
}

/**
 * Chỉ cho vai trò trong `allow` vào nhóm route con; sai vai trò → về trang chủ của vai trò đó.
 * Đặt bên dưới `AccountGate` (đã xử lý tài khoản khóa / lỗi tải). Chỉ phục vụ UX: dữ liệu được
 * RLS và RPC chặn ở database.
 */
export function RoleGuard({ allow }: RoleGuardProps) {
  const account = useAccount()
  if (!account.data) return <PageLoader />

  const access = resolveRoleAccess(account.data, allow)
  if (access.kind === 'redirect') return <Navigate to={access.to} replace />
  if (access.kind === 'locked') return <Navigate to={homePathForRole(account.data.role)} replace />
  return <Outlet />
}

/** `/`: chuyển hướng theo vai trò (admin → /admin, seller → /seller, customer → không có quyền). */
export function HomeRedirect() {
  const account = useAccount()
  if (!account.data) return <PageLoader />
  return <Navigate to={homePathForRole(account.data.role)} replace />
}
