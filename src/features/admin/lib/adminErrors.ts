import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Mã lỗi do RPC admin / Edge Function trả về → thông báo tiếng Việt. */
export const ADMIN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NOT_ADMIN: 'Bạn không có quyền quản trị để thực hiện thao tác này.',
  REASON_REQUIRED: 'Vui lòng nhập lý do (tối đa 1000 ký tự).',
  SELLER_NOT_FOUND: 'Không tìm thấy shop.',
  SELLER_NOT_PENDING: 'Hồ sơ không còn ở trạng thái chờ duyệt (có thể admin khác vừa xử lý).',
  INVALID_DECISION: 'Quyết định duyệt không hợp lệ.',
  INVALID_SELLER_TRANSITION: 'Không thể chuyển shop sang trạng thái này từ trạng thái hiện tại.',
  ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản.',
  CANNOT_LOCK_SELF: 'Bạn không thể khóa tài khoản của chính mình.',
  CANNOT_LOCK_ADMIN: 'Không thể khóa tài khoản quản trị viên khác.',
  CANNOT_DELETE_SELF: 'Bạn không thể xóa tài khoản của chính mình.',
  CANNOT_DELETE_ADMIN: 'Không thể xóa tài khoản quản trị viên.',
  ACCOUNT_NOT_ACTIVE: 'Tài khoản đã bị xóa hoặc đang chờ xác nhận xóa.',
  ACCOUNT_PENDING_DELETION:
    'Tài khoản đang chờ xóa / đã xóa. Hãy khôi phục tài khoản trước khi khóa hoặc mở khóa.',
  INVALID_EVIDENCE: 'File bằng chứng không hợp lệ. Vui lòng tải lại file.',
  TOO_MANY_EVIDENCE: 'Tối đa 10 file bằng chứng cho mỗi lần xóa.',
  EVIDENCE_UPLOAD_FAILED: 'Không tải được file bằng chứng lên. Vui lòng kiểm tra mạng và thử lại.',
  DELETION_NOT_FOUND: 'Không tìm thấy hồ sơ xóa tài khoản.',
  DELETION_NOT_PENDING: 'Hồ sơ không còn ở trạng thái chờ xác nhận.',
  DELETION_NOT_RESTORABLE: 'Tài khoản này đã được khôi phục trước đó.',
  EMAIL_NOT_CONFIGURED: 'Máy chủ chưa cấu hình gửi email (RESEND_API_KEY / EMAIL_FROM).',
  EMAIL_SEND_FAILED: 'Dịch vụ email từ chối gửi thư. Kiểm tra cấu hình Resend rồi gửi lại.',
}

export function getAdminErrorMessage(error: unknown): string {
  const { message } = getDbErrorInfo(error)
  if (message && ADMIN_ERROR_MESSAGES[message]) return ADMIN_ERROR_MESSAGES[message]
  return getErrorMessage(error)
}
