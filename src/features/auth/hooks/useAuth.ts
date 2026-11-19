import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  session: Session | null
  /** Phiên hiện tại đến từ link "đặt lại mật khẩu" trong thư. */
  recovery: boolean
  setSession: (session: Session | null) => void
  setRecovery: (recovery: boolean) => void
}

/**
 * Phiên đăng nhập hiện tại. Nguồn sự thật là Supabase Auth; store này chỉ phản chiếu
 * sự kiện từ `onAuthStateChange` (xem `initAuth`) để React render lại.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  recovery: false,
  setSession: (session) =>
    set((state) => ({
      session,
      status: session ? 'authenticated' : 'unauthenticated',
      recovery: session ? state.recovery : false,
    })),
  setRecovery: (recovery) => set({ recovery }),
}))

export const useAuthStatus = (): AuthStatus => useAuthStore((s) => s.status)

export const useCurrentUser = (): User | null => useAuthStore((s) => s.session?.user ?? null)

export const useIsRecoverySession = (): boolean =>
  useAuthStore((s) => s.status === 'authenticated' && s.recovery)
