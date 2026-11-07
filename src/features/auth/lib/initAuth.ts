import { queryClient } from '@/shared/lib/queryClient'
import { subscribeToAuthChanges } from '../api/auth.api'
import { useAuthStore } from '../hooks/useAuth'

let unsubscribe: (() => void) | undefined

/**
 * Đồng bộ phiên Supabase vào auth store. Gọi một lần trước khi render app.
 * Supabase phát `INITIAL_SESSION` ngay khi đăng ký, nên store thoát trạng thái `loading`
 * mà không cần gọi `getSession()` riêng.
 */
export function initAuth(): void {
  if (unsubscribe) return

  let currentUserId: string | undefined
  unsubscribe = subscribeToAuthChanges((_event, session) => {
    const nextUserId = session?.user.id
    // Đổi user hoặc đăng xuất → xóa cache để không lộ dữ liệu của phiên trước.
    if (currentUserId !== undefined && currentUserId !== nextUserId) {
      queryClient.clear()
    }
    currentUserId = nextUserId
    useAuthStore.getState().setSession(session)
  })
}
