import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  session: Session | null
  setSession: (session: Session | null) => void
}

/**
 * Phiên đăng nhập hiện tại. Nguồn sự thật là Supabase Auth; store này chỉ phản chiếu
 * sự kiện từ `onAuthStateChange` (xem `initAuth`) để React render lại.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  setSession: (session) => set({ session, status: session ? 'authenticated' : 'unauthenticated' }),
}))

export const useAuthStatus = (): AuthStatus => useAuthStore((s) => s.status)

export const useCurrentUser = (): User | null => useAuthStore((s) => s.session?.user ?? null)
