import { Center } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { Outlet } from 'react-router'
import { ErrorState } from '@/shared/components/ErrorState'
import { PageLoader } from '@/shared/components/PageLoader'
import { useAccount } from '../api/auth.queries'
import { getAuthErrorMessage } from '../lib/authErrors'
import { BlockedScreen } from './BlockedScreen'
import { SignOutButton } from './SignOutButton'

/**
 * Lớp đầu tiên sau đăng nhập: đọc tài khoản (role, khóa) từ `profiles`. Tài khoản bị khóa
 * không vào được bất kỳ trang nào — DB cũng đã chặn mọi quyền của tài khoản khóa.
 */
export function AccountGate() {
  const account = useAccount()

  if (account.isPending) return <PageLoader />

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
