import type { Enums } from '@/shared/types/database.types'

/**
 * Quy trình phiếu nhập kho: NHÁP → ĐÃ NHẬP KHO.
 *  - Nháp: sửa / xóa được, chưa ảnh hưởng tồn kho và giá vốn.
 *  - Đã nhập kho: chứng từ đã ghi sổ — không sửa / xóa (sai sót xử lý bằng điều chỉnh kho).
 */
export type ReceiptStatus = Enums<'receipt_status'>

export const RECEIPT_STATUSES = ['draft', 'posted'] as const satisfies readonly ReceiptStatus[]

export const RECEIPT_STATUS_META: Readonly<
  Record<ReceiptStatus, { label: string; color: string }>
> = {
  draft: { label: 'Nháp', color: 'gray' },
  posted: { label: 'Đã nhập kho', color: 'teal' },
}

export function isEditable(status: ReceiptStatus): boolean {
  return status === 'draft'
}
