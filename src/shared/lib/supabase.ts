import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { env } from './env'

const TAB_ID_KEY = 'sellerops-tab-id'

/**
 * Id riêng của tab trình duyệt. `sessionStorage` vốn tách biệt giữa các tab và vẫn giữ khi tải
 * lại trang, nên id ổn định trong suốt vòng đời của tab.
 */
function getTabId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    window.sessionStorage.setItem(TAB_ID_KEY, id)
    return id
  } catch {
    // sessionStorage bị chặn (chế độ riêng tư nghiêm ngặt): id tạm cho lần tải trang này.
    return crypto.randomUUID()
  }
}

/**
 * Phiên đăng nhập theo từng tab (mặc định): mỗi tab đăng nhập một tài khoản riêng, ví dụ tab admin
 * và tab seller chạy song song.
 *  - `sessionStorage` thay cho `localStorage`: phiên không dùng chung giữa các tab.
 *  - `storageKey` riêng mỗi tab: Supabase đồng bộ đăng nhập / đăng xuất giữa các tab qua
 *    BroadcastChannel đặt tên theo storageKey; key riêng thì tab này không nhận phiên của tab khác.
 * Đánh đổi: mở tab mới (hoặc đóng trình duyệt rồi mở lại) phải đăng nhập lại.
 * Đặt `VITE_AUTH_SHARED_SESSION=true` để quay về hành vi mặc định của Supabase (dùng chung phiên).
 */
function authOptions(): SupabaseClientOptions<'public'>['auth'] {
  if (env.VITE_AUTH_SHARED_SESSION || typeof window === 'undefined') return undefined
  return {
    storage: window.sessionStorage,
    storageKey: `sellerops-auth-${getTabId()}`,
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
