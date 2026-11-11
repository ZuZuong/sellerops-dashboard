import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Mã lỗi do RPC phiếu nhập raise (migration `purchasing_costing`). */
const RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  RECEIPT_NOT_FOUND: 'Phiếu nhập không tồn tại hoặc đã bị xóa.',
  RECEIPT_NOT_DRAFT: 'Phiếu đã nhập kho nên không thể sửa hoặc xóa.',
  RECEIPT_EMPTY: 'Phiếu nhập chưa có sản phẩm nào.',
  RECEIPT_NO_RECEIVED: 'Phiếu không có hàng đạt để nhập kho (SL thực nhận đều bằng 0).',
  INVALID_SUPPLIER: 'Vui lòng nhập tên nhà cung cấp.',
  INVALID_RECEIPT_ITEM: 'Số lượng hoặc đơn giá trên phiếu không hợp lệ.',
  DUPLICATE_PRODUCT: 'Một sản phẩm xuất hiện nhiều lần trên phiếu.',
  PRODUCT_NOT_FOUND: 'Có sản phẩm không tồn tại hoặc đã bị xóa.',
  TOO_MANY_ROWS: 'Phiếu nhập có quá nhiều dòng.',
  NOT_AUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
}

export function getReceiptErrorMessage(error: unknown): string {
  const { message } = getDbErrorInfo(error)
  if (message && RPC_ERROR_MESSAGES[message]) return RPC_ERROR_MESSAGES[message]
  return getErrorMessage(error)
}
