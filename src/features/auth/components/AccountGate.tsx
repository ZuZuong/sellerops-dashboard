import { Center } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { ErrorState } from '@/shared/components/ErrorState'
import { PageLoader } from '@/shared/components/PageLoader'
import { useAccount, useForceSignOut } from '../api/auth.queries'
import { isAccountRemoved } from '../domain/account'
import { useAccountRealtime } from '../hooks/useAccountRealtime'
import { useAuthStore, useCurrentUser } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/authErrors'
import { BlockedScreen } from './BlockedScreen'
import { SignOutButton } from './SignOutButton'

/**
 * Lớp đầu tiên sau đăng nhập: đọc tài khoản (role, khóa, trạng thái) từ `profiles` và nghe thay
 * đổi qua Realtime.
 *  - Tài khoản bị admin xóa → đăng xuất NGAY, về /login kèm thông báo.
 *  - Tài khoản bị khóa → màn hình khóa.
 * Database đã tước mọi quyền của tài khoản khóa / xóa — lớp này chỉ phục vụ trải nghiệm.
 */
export function AccountGate() {
  const user = useCurrentUser()
  const account = useAccount()
  const forceSignOut = useForceSignOut()
  useAccountRealtime(user?.id)

  const removed = account.data ? isAccountRemoved(account.data) : false
  const { mutate: signOut } = forceSignOut

  useEffect(() => {
    if (!removed) return
    useAuthStore.getState().setSignOutReason('account_removed')
    signOut()
  }, [removed, signOut])

  if (account.isPending || removed) return <PageLoader />

  if (account.isError) {
    return (
      <Center mih="100vh" px="md">
        <div>
          <ErrorState
            title="Không tải được thông tin tài khoản"
            message={getAuthErrorMessage(account.error)}
            onRetry={() => void account.refetch()}
            retrying={account.isRefetching}
          />
          <Center>
            <SignOutButton size="xs" />
          </Center>
        </div>
      </Center>
    )
  }

  if (account.data.isLocked) {
    return (
      <BlockedScreen icon={<IconLock size={28} />} color="red" title="Tài khoản đã bị khóa">
        Tài khoản <strong>{account.data.email}</strong> đã bị quản trị viên khóa
        {account.data.lockedReason ? ` với lý do: "${account.data.lockedReason}"` : ''}. Vui lòng
        liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.
      </BlockedScreen>
    )
  }

  return <Outlet />
}
