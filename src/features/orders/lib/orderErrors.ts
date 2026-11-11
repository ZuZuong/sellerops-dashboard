import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Mã lỗi nghiệp vụ do RPC / trigger raise (xem migrations). */
const RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INSUFFICIENT_STOCK: 'Không đủ tồn kho để xác nhận đơn. Hãy nhập thêm hàng hoặc giảm số lượng.',
  ORDER_NOT_PENDING: 'Đơn hàng không còn ở trạng thái chờ xác nhận (có thể đã được xử lý).',
  ORDER_NOT_FOUND: 'Đơn hàng không tồn tại hoặc bạn không có quyền truy cập.',
  ORDER_EMPTY: 'Đơn hàng chưa có sản phẩm nào.',
  INVALID_STATUS_TRANSITION: 'Không thể chuyển đơn sang trạng thái này. Vui lòng tải lại đơn hàng.',
  PRODUCT_NOT_AVAILABLE: 'Có sản phẩm đã ngừng bán hoặc không còn tồn tại.',
  INVALID_CUSTOMER: 'Tên khách hàng không hợp lệ.',
  INVALID_QUANTITY: 'Số lượng sản phẩm không hợp lệ.',
  DUPLICATE_PRODUCT: 'Một sản phẩm bị chọn nhiều lần trong đơn.',
  TOO_MANY_ITEMS: 'Đơn hàng có quá nhiều sản phẩm.',
  NOT_AUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

/** SQLSTATE của Postgres. */
const SQLSTATE_MESSAGES: Readonly<Record<string, string>> = {
  '23505': 'Mã đơn bị trùng. Vui lòng thử lại.',
  '23514': 'Dữ liệu đơn hàng không hợp lệ.',
}

/** Lỗi gắn với một sản phẩm cụ thể (RPC raise kèm `detail = product_id`). */
const PRODUCT_SCOPED_MESSAGES: Readonly<Record<string, (name: string) => string>> = {
  INSUFFICIENT_STOCK: (name) =>
    `Không đủ tồn kho cho "${name}". Hãy nhập thêm hàng hoặc giảm số lượng rồi xác nhận lại.`,
  PRODUCT_NOT_AVAILABLE: (name) => `"${name}" đã ngừng bán hoặc không còn tồn tại.`,
}

/**
 * Chuyển lỗi từ API đơn hàng thành thông báo tiếng Việt.
 * `productNames` (product_id → tên) giúp chỉ rõ sản phẩm nào thiếu hàng.
 */
export function getOrderErrorMessage(
  error: unknown,
  productNames?: ReadonlyMap<string, string>,
): string {
  const { code, message, details } = getDbErrorInfo(error)
  if (message) {
    const name = details ? productNames?.get(details) : undefined
    const scoped = PRODUCT_SCOPED_MESSAGES[message]
    if (name && scoped) return scoped(name)
    const known = RPC_ERROR_MESSAGES[message]
    if (known) return known
  }
  if (code && SQLSTATE_MESSAGES[code]) return SQLSTATE_MESSAGES[code]
  return getErrorMessage(error)
}
