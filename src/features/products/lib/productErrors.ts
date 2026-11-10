import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Mã lỗi nghiệp vụ do RPC raise (xem migrations). */
const RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PRODUCT_IN_ORDERS:
    'Sản phẩm đã có trong đơn hàng nên không thể xóa. Hãy chuyển sang "Ngừng bán" để giữ lịch sử đơn.',
  PRODUCT_NOT_FOUND: 'Sản phẩm không tồn tại hoặc đã bị xóa.',
  INSUFFICIENT_STOCK: 'Tồn kho không đủ để giảm số lượng này.',
  INVALID_DELTA: 'Số lượng điều chỉnh không hợp lệ.',
  // Lỗi phía client (xem productImages.api.ts)
  IMAGE_UPLOAD_FAILED: 'Không tải được ảnh lên. Vui lòng kiểm tra mạng và thử lại.',
  NOT_AUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

/** SQLSTATE của Postgres. */
const SQLSTATE_MESSAGES: Readonly<Record<string, string>> = {
  '23505': 'Mã SKU bị trùng. Vui lòng thử lại.',
  '23503': RPC_ERROR_MESSAGES.PRODUCT_IN_ORDERS ?? '',
  '23514': 'Dữ liệu không hợp lệ (giá / tồn kho âm, mô tả quá dài hoặc quá nhiều ảnh).',
}

/** Chuyển lỗi từ API sản phẩm thành thông báo tiếng Việt. */
export function getProductErrorMessage(error: unknown): string {
  const { code, message } = getDbErrorInfo(error)
  if (message && RPC_ERROR_MESSAGES[message]) return RPC_ERROR_MESSAGES[message]
  if (code && SQLSTATE_MESSAGES[code]) return SQLSTATE_MESSAGES[code]
  return getErrorMessage(error)
}
