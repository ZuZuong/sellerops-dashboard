import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Mã lỗi nghiệp vụ do RPC raise (xem migrations). */
const RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PRODUCT_IN_ORDERS:
    'Sản phẩm đã có trong đơn hàng nên không thể xóa. Hãy chuyển sang "Ngừng bán" để giữ lịch sử đơn.',
  PRODUCT_NOT_FOUND: 'Sản phẩm không tồn tại hoặc đã bị xóa.',
  INSUFFICIENT_STOCK: 'Tồn kho không đủ để giảm số lượng này.',
  INVALID_DELTA: 'Số lượng điều chỉnh không hợp lệ.',
}

/** SQLSTATE của Postgres. */
const SQLSTATE_MESSAGES: Readonly<Record<string, string>> = {
  '23505': 'Mã SKU bị trùng. Vui lòng thử lại.',
  '23503': RPC_ERROR_MESSAGES.PRODUCT_IN_ORDERS ?? '',
  '23514': 'Dữ liệu không hợp lệ: giá, tồn kho và ngưỡng cảnh báo phải lớn hơn hoặc bằng 0.',
}

/** Chuyển lỗi từ API sản phẩm thành thông báo tiếng Việt. */
export function getProductErrorMessage(error: unknown): string {
  const { code, message } = getDbErrorInfo(error)
  if (message && RPC_ERROR_MESSAGES[message]) return RPC_ERROR_MESSAGES[message]
  if (code && SQLSTATE_MESSAGES[code]) return SQLSTATE_MESSAGES[code]
  return getErrorMessage(error)
}
