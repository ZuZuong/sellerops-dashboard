import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { env } from '../env'

/**
 * Tài khoản demo chạy HOÀN TOÀN trong trình duyệt (xem ADR 011): không gọi Supabase, dữ liệu nằm
 * trong `sessionStorage` của tab nên đóng tab là mất. Mật khẩu nằm trong bundle là chủ ý — tài
 * khoản chỉ mở được dữ liệu giả của chính tab đó, không chạm tới database thật.
 */
export type DemoRole = 'admin' | 'seller'

export interface DemoAccount {
  username: string
  password: string
  role: DemoRole
  userId: string
  email: string
  fullName: string
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    username: 'admintest',
    password: 'admintest001',
    role: 'admin',
    userId: 'd0000000-0000-4000-8000-00000000a001',
    email: 'admintest@sellerops.demo',
    fullName: 'Quản trị viên Demo',
  },
  {
    username: 'sellertest',
    password: 'sellertest01',
    role: 'seller',
    userId: 'd0000000-0000-4000-8000-00000000b001',
    email: 'sellertest@sellerops.demo',
    fullName: 'Nguyễn Văn Demo',
  },
]

/** Bật mặc định; đặt `VITE_DEMO_ACCOUNTS=false` để tắt hẳn đăng nhập demo. */
export const isDemoEnabled = (): boolean => env.VITE_DEMO_ACCOUNTS

/** Tìm tài khoản demo theo tên đăng nhập hoặc email (không phân biệt hoa thường). */
export function findDemoAccount(login: string): DemoAccount | undefined {
  if (!isDemoEnabled()) return undefined
  const key = login.trim().toLowerCase()
  return DEMO_ACCOUNTS.find((account) => account.username === key || account.email === key)
}

export const isDemoUsername = (login: string): boolean => findDemoAccount(login) !== undefined

const SESSION_KEY = 'sellerops.demo.session'

function readStoredUserId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

let currentUserId: string | null = isDemoEnabled() ? readStoredUserId() : null

/** Tab đang chạy phiên demo → mọi hàm `api/` dùng backend giả lập thay cho Supabase. */
export const isDemoMode = (): boolean => currentUserId !== null

export function getDemoAccount(): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.userId === currentUserId) ?? null
}

export function getDemoUserId(): string | null {
  return currentUserId
}

export function buildDemoSession(account: DemoAccount, signedInAt = new Date()): Session {
  const user: User = {
    id: account.userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: account.email,
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    app_metadata: { provider: 'demo' },
    user_metadata: { full_name: account.fullName },
    created_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: signedInAt.toISOString(),
  }
  const expiresIn = 24 * 3600
  return {
    access_token: 'demo',
    refresh_token: 'demo',
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(signedInAt.getTime() / 1000) + expiresIn,
    user,
  }
}

export function getDemoSession(): Session | null {
  const account = getDemoAccount()
  return account ? buildDemoSession(account) : null
}

type Listener = (event: AuthChangeEvent, session: Session | null) => void
const listeners = new Set<Listener>()

/** Nghe đăng nhập / đăng xuất demo (cùng chữ ký với `onAuthStateChange` của Supabase). */
export function onDemoAuthChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function startDemoSession(account: DemoAccount): Session {
  currentUserId = account.userId
  try {
    window.sessionStorage.setItem(SESSION_KEY, account.userId)
  } catch {
    // Không lưu được (chế độ riêng tư nghiêm ngặt): phiên vẫn chạy tới khi tải lại trang.
  }
  const session = buildDemoSession(account)
  listeners.forEach((listener) => listener('SIGNED_IN', session))
  return session
}

export function endDemoSession(): void {
  currentUserId = null
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Bỏ qua: đã xóa trong bộ nhớ.
  }
  listeners.forEach((listener) => listener('SIGNED_OUT', null))
}
