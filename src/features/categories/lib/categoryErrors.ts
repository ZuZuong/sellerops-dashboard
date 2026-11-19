import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Mã lỗi do các RPC danh mục raise (xem migration multi_tenant_rpcs). */
const CATEGORY_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_CATEGORY_NAME: 'Tên danh mục phải từ 1 đến 50 ký tự.',
  CATEGORY_NAME_EXISTS: 'Đã có danh mục cùng tên.',
  CATEGORY_NOT_FOUND: 'Danh mục không tồn tại hoặc đã bị xóa.',
  CATEGORY_IN_USE: 'Danh mục đang có sản phẩm. Hãy chọn danh mục để chuyển sản phẩm sang.',
  INVALID_MOVE_TARGET: 'Danh mục chuyển sang không hợp lệ.',
  CATEGORY_EDIT_NOT_ALLOWED:
    'Không sửa được danh mục khi hồ sơ đang chờ duyệt hoặc shop đang bị tạm khóa.',
  SELLER_NOT_FOUND: 'Không tìm thấy shop của tài khoản này.',
  NOT_AUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

export function getCategoryErrorMessage(error: unknown): string {
  const { message } = getDbErrorInfo(error)
  if (message && CATEGORY_ERROR_MESSAGES[message]) return CATEGORY_ERROR_MESSAGES[message]
  return getErrorMessage(error)
}
