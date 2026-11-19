import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  email_not_confirmed: 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.',
  user_banned: 'Tài khoản đã bị khóa.',
  over_request_rate_limit: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.',
  over_email_send_rate_limit: 'Đã gửi quá nhiều thư. Vui lòng đợi vài phút rồi thử lại.',
  weak_password: 'Mật khẩu quá yếu. Hãy dùng mật khẩu dài hơn, khó đoán hơn.',
  same_password: 'Mật khẩu mới phải khác mật khẩu cũ.',
  email_address_invalid: 'Email không hợp lệ.',
  signup_disabled: 'Hệ thống tạm ngừng nhận đăng ký mới.',
  session_not_found: 'Phiên đã hết hạn. Vui lòng mở lại link trong thư hoặc đăng nhập lại.',
  // Email đã có tài khoản: không nói rõ để tránh dò email (chỉ gặp khi tắt Confirm email).
  user_already_exists: 'Không thể đăng ký với email này. Hãy thử đăng nhập hoặc quên mật khẩu.',
  email_exists: 'Không thể đăng ký với email này. Hãy thử đăng nhập hoặc quên mật khẩu.',
}

/** Lỗi do RPC `register_as_seller` raise khi khởi tạo shop sau đăng ký. */
const ACCOUNT_RPC_MESSAGES: Readonly<Record<string, string>> = {
  ADMIN_CANNOT_BE_SELLER: 'Tài khoản quản trị không thể đăng ký làm seller.',
  EMAIL_NOT_CONFIRMED: 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.',
}

const NETWORK_ERROR_MESSAGE = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.'
const FALLBACK_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.'

/** Chuyển lỗi từ Supabase Auth thành thông báo tiếng Việt cho người dùng. */
export function getAuthErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NETWORK_ERROR_MESSAGE
  if (isAuthError(error)) {
    return (error.code && AUTH_ERROR_MESSAGES[error.code]) || FALLBACK_MESSAGE
  }
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE
  const rpc = ACCOUNT_RPC_MESSAGES[getDbErrorInfo(error).message ?? '']
  return rpc ?? getErrorMessage(error)
}

/** Mã lỗi của link trong thư (`#error_code=…`) → thông báo. */
export function getRedirectErrorMessage(errorCode: string): string {
  return errorCode === 'otp_expired'
    ? 'Link trong thư đã hết hạn hoặc đã được dùng.'
    : 'Link trong thư không hợp lệ.'
}

/** Lỗi khi gửi thư quên mật khẩu chỉ hiện nếu là lỗi mạng / giới hạn tần suất (không lộ email). */
export function isDisclosableResetError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return true
  return (
    isAuthError(error) &&
    (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')
  )
}
