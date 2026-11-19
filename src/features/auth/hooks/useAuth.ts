import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/** Lý do app chủ động đăng xuất người dùng — trang đăng nhập hiển thị thông báo tương ứng. */
export type SignOutReason = 'account_removed'

interface AuthState {
  status: AuthStatus
  session: Session | null
  /** Phiên hiện tại đến từ link "đặt lại mật khẩu" trong thư. */
  recovery: boolean
  signOutReason: SignOutReason | null
  setSession: (session: Session | null) => void
  setRecovery: (recovery: boolean) => void
  setSignOutReason: (reason: SignOutReason | null) => void
}

/**
 * Phiên đăng nhập hiện tại. Nguồn sự thật là Supabase Auth; store này chỉ phản chiếu
 * sự kiện từ `onAuthStateChange` (xem `initAuth`) để React render lại.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  recovery: false,
  signOutReason: null,
  setSession: (session) =>
    set((state) => ({
      session,
      status: session ? 'authenticated' : 'unauthenticated',
      recovery: session ? state.recovery : false,
      // Đăng nhập lại → bỏ thông báo "đã bị đăng xuất" của phiên trước.
      signOutReason: session ? null : state.signOutReason,
    })),
  setRecovery: (recovery) => set({ recovery }),
  setSignOutReason: (signOutReason) => set({ signOutReason }),
}))

export const useAuthStatus = (): AuthStatus => useAuthStore((s) => s.status)

export const useCurrentUser = (): User | null => useAuthStore((s) => s.session?.user ?? null)

export const useIsRecoverySession = (): boolean =>
  useAuthStore((s) => s.status === 'authenticated' && s.recovery)

export const useSignOutReason = (): SignOutReason | null => useAuthStore((s) => s.signOutReason)
