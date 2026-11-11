import { z } from 'zod'

/** Giới hạn theo cột `int` (int4) trong DB. */
export const MAX_STOCK = 2_147_483_647
export const MAX_NOTE = 200

export const ADJUST_TYPES = ['import', 'export', 'count'] as const
export type AdjustType = (typeof ADJUST_TYPES)[number]

export const ADJUST_TYPE_META: Readonly<
  Record<AdjustType, { label: string; quantityLabel: string; description: string }>
> = {
  import: {
    label: 'Nhập hàng',
    quantityLabel: 'Số lượng nhập',
    description: 'Cộng thêm vào tồn kho',
  },
  export: {
    label: 'Xuất hủy',
    quantityLabel: 'Số lượng xuất',
    description: 'Hàng hỏng, thất lạc, trả nhà cung cấp…',
  },
  count: {
    label: 'Kiểm kê',
    quantityLabel: 'Tồn kho thực tế',
    description: 'Đặt lại tồn kho theo số đếm thực tế',
  },
}

/**
 * Chuyển thao tác người dùng thành delta gửi RPC `adjust_stock` (DB chỉ nhận delta để kiểm tra
 * tồn kho không âm và ghi lịch sử trong cùng transaction).
 */
export function computeStockDelta(
  type: AdjustType,
  quantity: number,
  currentStock: number,
): number {
  if (type === 'import') return quantity
  if (type === 'export') return -quantity
  return quantity - currentStock
}

/** Ghi chú lưu vào `inventory_movements.note`: loại thao tác + ghi chú người dùng. */
export function buildAdjustNote(type: AdjustType, note: string | null): string {
  const label = ADJUST_TYPE_META[type].label
  return note ? `${label}: ${note}` : label
}

/** Schema phụ thuộc tồn kho hiện tại (để chặn xuất quá số đang có, kiểm kê không đổi gì). */
export function createStockAdjustSchema(currentStock: number) {
  return z
    .object({
      type: z.enum(ADJUST_TYPES),
      quantity: z
        .number({ error: 'Vui lòng nhập số lượng' })
        .int('Số lượng phải là số nguyên')
        .min(0, 'Số lượng không được âm')
        .max(MAX_STOCK, 'Số lượng quá lớn'),
      note: z
        .string()
        .trim()
        .max(MAX_NOTE, `Ghi chú tối đa ${MAX_NOTE} ký tự`)
        .transform((note) => (note === '' ? null : note)),
    })
    .superRefine(({ type, quantity }, ctx) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: 'custom', message, path: ['quantity'] })
      if (type !== 'count' && quantity === 0) issue('Số lượng phải lớn hơn 0')
      if (type === 'export' && quantity > currentStock) {
        issue(`Không thể xuất quá tồn kho hiện tại (${currentStock})`)
      }
      if (type === 'import' && currentStock + quantity > MAX_STOCK)
        issue('Tồn kho sau nhập quá lớn')
      if (type === 'count' && quantity === currentStock) {
        issue('Tồn kho thực tế bằng tồn kho hiện tại — không có gì thay đổi')
      }
    })
}

export type StockAdjustInput = z.input<ReturnType<typeof createStockAdjustSchema>>
export type StockAdjustValues = z.output<ReturnType<typeof createStockAdjustSchema>>
