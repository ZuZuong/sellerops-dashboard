import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  email_not_confirmed: 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.',
  user_banned: 'Tài khoản đã bị khóa.',
  over_request_rate_limit: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.',
}

const NETWORK_ERROR_MESSAGE = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.'
const FALLBACK_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.'

/** Chuyển lỗi từ Supabase Auth thành thông báo tiếng Việt cho người dùng. */
export function getAuthErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NETWORK_ERROR_MESSAGE
  if (isAuthError(error) && error.code) {
    return AUTH_ERROR_MESSAGES[error.code] ?? FALLBACK_MESSAGE
  }
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE
  return FALLBACK_MESSAGE
}
