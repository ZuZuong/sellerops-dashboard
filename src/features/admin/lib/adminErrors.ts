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
  DELETION_NOT_PENDING: 'Tài khoản không còn trong thùng rác (đã khôi phục hoặc đã xóa vĩnh viễn).',
  DELETION_NOT_RESTORABLE:
    'Chỉ khôi phục được tài khoản còn trong thùng rác (đã khôi phục hoặc đã xóa vĩnh viễn thì không).',
  EMAIL_NOT_CONFIGURED:
    'Máy chủ chưa cấu hình gửi email: thiếu secret RESEND_API_KEY hoặc EMAIL_FROM trên Supabase.',
  EMAIL_SEND_FAILED: 'Dịch vụ email từ chối gửi thư. Kiểm tra cấu hình Resend rồi gửi lại.',
  EMAIL_SENDER_NOT_ALLOWED:
    'Resend từ chối người gửi / người nhận. Khi dùng onboarding@resend.dev chỉ gửi được tới email chủ tài khoản Resend; muốn gửi cho seller phải xác minh domain.',
  EMAIL_FUNCTION_NOT_DEPLOYED:
    'Chức năng gửi email (Edge Function notify-account-deletion) chưa được deploy lên Supabase.',
  EMAIL_FUNCTION_UNREACHABLE:
    'Không gọi được chức năng gửi email (mạng hoặc cấu hình ALLOWED_ORIGINS). Thử gửi lại sau.',
}

export function getAdminErrorMessage(error: unknown): string {
  const { message } = getDbErrorInfo(error)
  if (message && ADMIN_ERROR_MESSAGES[message]) return ADMIN_ERROR_MESSAGES[message]
  return getErrorMessage(error)
}
