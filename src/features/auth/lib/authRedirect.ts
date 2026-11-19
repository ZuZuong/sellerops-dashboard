/**
 * Thông tin Supabase gắn vào URL khi người dùng mở link trong thư (xác minh email, đặt lại mật
 * khẩu): `#type=recovery&access_token=…` khi thành công, `#error=…&error_code=otp_expired…` khi
 * link hết hạn / đã dùng.
 *
 * Supabase client xử lý rồi XÓA phần này khỏi URL ngay khi khởi tạo, nên phải chụp lại đồng bộ
 * lúc app khởi động (`initAuth`), trước khi bất kỳ promise nào của client kịp chạy.
 */
export interface AuthRedirectInfo {
  /** `recovery` (đặt lại mật khẩu), `signup` (xác minh email)… hoặc null. */
  type: string | null
  /** Mã lỗi (vd. `otp_expired`) hoặc null nếu link hợp lệ. */
  errorCode: string | null
}

const EMPTY: AuthRedirectInfo = { type: null, errorCode: null }

/** Đọc tham số từ cả hash (luồng implicit) lẫn query string (luồng PKCE / lỗi từ server). */
export function parseAuthRedirect(hash: string, search: string): AuthRedirectInfo {
  const fromHash = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const fromQuery = new URLSearchParams(search)
  const read = (key: string) => fromHash.get(key) ?? fromQuery.get(key)

  const error = read('error')
  const errorCode = read('error_code') ?? error
  return { type: read('type'), errorCode: errorCode || null }
}

let captured: AuthRedirectInfo = EMPTY

export function captureAuthRedirect(location: Pick<Location, 'hash' | 'search'>): void {
  captured = parseAuthRedirect(location.hash, location.search)
}

/** Thông tin đã chụp lúc khởi động (đọc nhiều lần được, không tiêu hủy). */
export function getAuthRedirect(): AuthRedirectInfo {
  return captured
}

/** Dùng trong test. */
export function resetAuthRedirect(): void {
  captured = EMPTY
}
