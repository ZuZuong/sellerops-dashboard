import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

/** Nhãn lý do biến động kho (cột `inventory_movements.reason`, CHECK trong DB). */
export const MOVEMENT_REASON_LABELS: Readonly<Record<string, string>> = {
  initial_stock: 'Tồn kho ban đầu',
  order_confirmed: 'Xác nhận đơn',
  order_cancelled: 'Hủy đơn – hoàn kho',
  manual_adjust: 'Điều chỉnh thủ công',
}

export function getMovementReasonLabel(reason: string): string {
  return MOVEMENT_REASON_LABELS[reason] ?? reason
}

/** Mã lỗi nghiệp vụ do RPC `adjust_stock` raise. */
const RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INSUFFICIENT_STOCK:
    'Tồn kho không đủ để giảm số lượng này (có thể vừa có đơn được xác nhận). Hãy tải lại và thử lại.',
  PRODUCT_NOT_FOUND: 'Sản phẩm không tồn tại hoặc đã bị xóa.',
  INVALID_DELTA: 'Số lượng điều chỉnh không hợp lệ.',
}

export function getInventoryErrorMessage(error: unknown): string {
  const { message } = getDbErrorInfo(error)
  if (message && RPC_ERROR_MESSAGES[message]) return RPC_ERROR_MESSAGES[message]
  return getErrorMessage(error)
}
