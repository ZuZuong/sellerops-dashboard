import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { subscribeToOwnProfile } from '../api/auth.api'
import { authKeys } from '../api/auth.queries'

/**
 * Admin khóa / xóa tài khoản → Realtime báo thay đổi trên dòng `profiles` của người dùng → đọc lại
 * tài khoản; `AccountGate` sẽ hiện màn hình khóa hoặc đăng xuất ngay.
 */
export function useAccountRealtime(userId: string | undefined) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!userId) return
    return subscribeToOwnProfile(userId, () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.account(userId) })
    })
  }, [userId, queryClient])
}
