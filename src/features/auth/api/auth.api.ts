import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { ROUTES } from '@/shared/constants/routes'
import { SELLER_SIGNUP_INTENT, SIGNUP_INTENT_KEY, type Account } from '../domain/account'
import type { LoginInput } from '../schemas/login.schema'
import type { RegisterInput } from '../schemas/register.schema'

/** Link trong thư quay về đúng domain đang chạy (localhost / Vercel) — phải nằm trong Redirect URLs. */
const appUrl = (path: string) => `${window.location.origin}${path}`

export async function signIn({ email, password }: LoginInput): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Đăng ký tài khoản seller. Với "Confirm email" bật, Supabase chỉ gửi thư xác minh, chưa tạo phiên.
 * Email đã tồn tại vẫn trả về thành công (không lộ email nào đã đăng ký) → UI luôn chuyển sang
 * màn hình "đã gửi thư xác minh".
 *
 * `signup_intent` chỉ là DẤU HIỆU để client biết cần gọi `register_as_seller()` sau khi xác minh;
 * quyền thật do RPC + bảng `profiles` quyết định (role không bao giờ đọc từ metadata).
 */
export async function signUp({ email, password, fullName }: RegisterInput): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appUrl(ROUTES.home),
      data: { full_name: fullName, [SIGNUP_INTENT_KEY]: SELLER_SIGNUP_INTENT },
    },
  })
  if (error) throw error
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: appUrl(ROUTES.home) },
  })
  if (error) throw error
}

/** Gửi thư đặt lại mật khẩu; link mở trang /reset-password. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(ROUTES.resetPassword),
  })
  if (error) throw error
}

/** Đặt mật khẩu mới cho phiên hiện tại (phiên khôi phục từ link trong thư). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/** Đăng ký lắng nghe thay đổi phiên; trả về hàm hủy đăng ký. */
export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, is_locked, locked_reason')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Tài khoản đăng ký từ trang đăng ký seller, đã xác minh email nhưng chưa có shop. */
export function needsSellerRegistration(
  user: Pick<User, 'email_confirmed_at' | 'user_metadata'>,
  role: Account['role'] | null,
): boolean {
  return (
    (role === null || role === 'customer') &&
    Boolean(user.email_confirmed_at) &&
    user.user_metadata[SIGNUP_INTENT_KEY] === SELLER_SIGNUP_INTENT
  )
}

/** Chạy `register_as_seller()` đúng một lần cho mỗi user, kể cả khi nhiều component gọi cùng lúc. */
const registrations = new Map<string, Promise<void>>()

function ensureSellerRegistration(userId: string): Promise<void> {
  const existing = registrations.get(userId)
  if (existing) return existing
  const pending = (async () => {
    const { error } = await supabase.rpc('register_as_seller')
    if (error) {
      // Cho phép thử lại ở lần sau (vd. lỗi mạng).
      registrations.delete(userId)
      throw error
    }
  })()
  registrations.set(userId, pending)
  return pending
}

/**
 * Tài khoản đang đăng nhập, role đọc từ `profiles`. Người vừa xác minh email sau khi đăng ký seller
 * được gọi `register_as_seller()` (idempotent ở DB: gọi lại trả về đúng shop đã có) rồi đọc lại.
 */
export async function fetchAccount(user: User): Promise<Account> {
  let profile = await fetchProfile(user.id)

  if (needsSellerRegistration(user, profile?.role ?? null) && !profile?.is_locked) {
    await ensureSellerRegistration(user.id)
    profile = await fetchProfile(user.id)
  }

  return {
    id: user.id,
    email: user.email ?? '',
    // Thiếu dòng profiles (trigger chưa chạy) → coi như customer: không có quyền dashboard.
    role: profile?.role ?? 'customer',
    fullName: profile?.full_name ?? null,
    isLocked: profile?.is_locked ?? false,
    lockedReason: profile?.locked_reason ?? null,
  }
}
