import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { rotateAuthStorageKey } from './authStorage'
import { env } from './env'

/**
 * Phiên đăng nhập theo từng tab (mặc định): mỗi tab đăng nhập một tài khoản riêng, ví dụ tab admin
 * và tab seller chạy song song.
 *  - `sessionStorage` thay cho `localStorage`: phiên không dùng chung giữa các tab.
 *  - `storageKey` mới mỗi lần tải trang (`rotateAuthStorageKey`): Supabase đồng bộ đăng nhập /
 *    đăng xuất giữa các tab qua BroadcastChannel đặt tên theo storageKey; key không bao giờ trùng
 *    thì tab này không nhận sự kiện của tab khác, kể cả tab nhân đôi.
 * Đánh đổi: mở tab mới (hoặc đóng trình duyệt rồi mở lại) phải đăng nhập lại.
 * Đặt `VITE_AUTH_SHARED_SESSION=true` để quay về hành vi mặc định của Supabase (dùng chung phiên).
 */
function authOptions(): SupabaseClientOptions<'public'>['auth'] {
  if (env.VITE_AUTH_SHARED_SESSION || typeof window === 'undefined') return undefined
  try {
    const storage = window.sessionStorage
    return { storage, storageKey: rotateAuthStorageKey(storage, crypto.randomUUID()) }
  } catch {
    // sessionStorage bị chặn (chế độ riêng tư nghiêm ngặt): dùng mặc định của Supabase.
    return undefined
  }
}

/**
 * Supabase client dùng chung cho toàn app.
 * Chỉ được import trong `features/<name>/api/` — component không gọi Supabase trực tiếp.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: authOptions() },
)
