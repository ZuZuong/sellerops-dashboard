import { IconUserX } from '@tabler/icons-react'
import { Navigate } from 'react-router'
import { PageLoader } from '@/shared/components/PageLoader'
import { useAccount } from '../api/auth.queries'
import { homePathForRole } from '../domain/account'
import { BlockedScreen } from './BlockedScreen'

/**
 * Tài khoản người mua (role `customer`) không có quyền vào dashboard. Vai trò khác lỡ mở trang
 * này thì được đưa về trang chủ của mình.
 */
export function NoAccessScreen() {
  const account = useAccount()
  if (!account.data) return <PageLoader />
  if (account.data.role !== 'customer') {
    return <Navigate to={homePathForRole(account.data.role)} replace />
  }

  return (
    <BlockedScreen
      icon={<IconUserX size={28} />}
      color="gray"
      title="Không có quyền truy cập dashboard"
    >
      Tài khoản <strong>{account.data.email}</strong> là tài khoản người mua nên không dùng được
      trang quản lý shop. Nếu bạn muốn bán hàng, hãy đăng ký tài khoản seller bằng một email khác.
    </BlockedScreen>
  )
}
