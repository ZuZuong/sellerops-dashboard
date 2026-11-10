export const NETWORK_ERROR_MESSAGE = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.'
export const FALLBACK_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.'

/**
 * Thông báo lỗi chung cho truy vấn dữ liệu. Không lộ chi tiết kỹ thuật (SQL, stack) ra UI;
 * lỗi nghiệp vụ cụ thể (mã RPC) được feature tự map trước khi rơi về đây.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE
  if (error instanceof Error && /failed to fetch|network ?error|load failed/i.test(error.message)) {
    return NETWORK_ERROR_MESSAGE
  }
  return FALLBACK_ERROR_MESSAGE
}
