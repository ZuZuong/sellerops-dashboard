export const NETWORK_ERROR_MESSAGE = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.'
export const FALLBACK_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.'

/**
 * Mã lỗi phân quyền dùng chung cho mọi RPC (`require_approved_seller`, `resolve_report_seller`…).
 * Feature nào cũng có thể gặp nên map ở đây thay vì lặp lại trong từng feature.
 */
const ACCESS_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_AUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  ACCOUNT_LOCKED: 'Tài khoản của bạn đã bị khóa.',
  SELLER_NOT_FOUND: 'Không tìm thấy shop của tài khoản này.',
  SELLER_NOT_APPROVED: 'Shop chưa được duyệt hoặc đang bị tạm khóa nên chưa thao tác được.',
  FORBIDDEN: 'Bạn không có quyền xem dữ liệu này.',
}

/**
 * Thông báo lỗi chung cho truy vấn dữ liệu. Không lộ chi tiết kỹ thuật (SQL, stack) ra UI;
 * lỗi nghiệp vụ cụ thể (mã RPC) được feature tự map trước khi rơi về đây.
 */
export function getErrorMessage(error: unknown): string {
  const access = ACCESS_ERROR_MESSAGES[getDbErrorInfo(error).message ?? '']
  if (access) return access
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE
  if (error instanceof Error && /failed to fetch|network ?error|load failed/i.test(error.message)) {
    return NETWORK_ERROR_MESSAGE
  }
  return FALLBACK_ERROR_MESSAGE
}

/** Mã lỗi Postgres/PostgREST đã chuẩn hóa, dùng để feature map sang thông báo nghiệp vụ. */
export interface DbErrorInfo {
  /** SQLSTATE (vd. '23505') hoặc mã PostgREST (vd. 'PGRST103'). */
  code: string | null
  /** Message gốc; với RPC tự định nghĩa đây là mã nghiệp vụ (vd. 'INSUFFICIENT_STOCK'). */
  message: string | null
  /** Chi tiết kèm theo (vd. RPC raise `using detail = product_id`). */
  details: string | null
}

export function getDbErrorInfo(error: unknown): DbErrorInfo {
  if (typeof error !== 'object' || error === null) {
    return { code: null, message: null, details: null }
  }
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null
  const message = 'message' in error && typeof error.message === 'string' ? error.message : null
  const details = 'details' in error && typeof error.details === 'string' ? error.details : null
  return { code, message, details }
}
