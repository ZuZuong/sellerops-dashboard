import { queryClient } from '@/shared/lib/queryClient'
import { subscribeToAuthChanges } from '../api/auth.api'
import { useAuthStore } from '../hooks/useAuth'
import { captureAuthRedirect, getAuthRedirect } from './authRedirect'

let unsubscribe: (() => void) | undefined

/**
 * Đồng bộ phiên Supabase vào auth store. Gọi một lần trước khi render app.
 * Supabase phát `INITIAL_SESSION` ngay khi đăng ký, nên store thoát trạng thái `loading`
 * mà không cần gọi `getSession()` riêng.
 */
export function initAuth(): void {
  if (unsubscribe) return

  // Chụp tham số link trong thư TRƯỚC khi Supabase client xóa chúng khỏi URL.
  captureAuthRedirect(window.location)
  if (getAuthRedirect().type === 'recovery') useAuthStore.getState().setRecovery(true)

  let currentUserId: string | undefined
  unsubscribe = subscribeToAuthChanges((event, session) => {
    const nextUserId = session?.user.id
    // Đổi user hoặc đăng xuất → xóa cache để không lộ dữ liệu của phiên trước.
    if (currentUserId !== undefined && currentUserId !== nextUserId) {
      queryClient.clear()
    }
    currentUserId = nextUserId
    if (event === 'PASSWORD_RECOVERY') useAuthStore.getState().setRecovery(true)
    useAuthStore.getState().setSession(session)
  })
}
