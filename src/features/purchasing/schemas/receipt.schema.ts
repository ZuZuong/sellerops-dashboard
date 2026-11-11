import { z } from 'zod'
import { isDateKey } from '@/shared/lib/dates'

/** Giới hạn theo cột `int` (int4) và numeric(14, 2) trong DB. */
export const MAX_QTY = 1_000_000
export const MAX_UNIT_COST = 999_999_999_999
export const MAX_RECEIPT_ITEMS = 100

const PHONE_PATTERN = /^(?:\+84|0)\d{9}$/

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} tối đa ${max} ký tự`)
    .transform((value) => (value === '' ? null : value))

const qty = (label: string, min: number) =>
  z
    .number({ error: `Nhập ${label.toLowerCase()}` })
    .int(`${label} phải là số nguyên`)
    .min(min, min === 0 ? `${label} không được âm` : `${label} tối thiểu là ${min}`)
    .max(MAX_QTY, `${label} quá lớn`)

const receiptItemSchema = z
  .object({
    // Giữ thông tin sản phẩm đã chọn để hiện ĐVT / tồn / giá vốn; chỉ product_id được gửi lên.
    product: z
      .object({
        id: z.string(),
        name: z.string(),
        sku: z.string(),
        unit: z.string(),
        stock: z.number(),
        cost_price: z.number(),
      })
      .nullable()
      .refine((product) => product !== null, 'Vui lòng chọn sản phẩm'),
    ordered_qty: qty('SL theo chứng từ', 1),
    received_qty: qty('SL thực nhận', 0),
    defective_qty: qty('SL lỗi', 0).default(0),
    unit_cost: z
      .number({ error: 'Nhập đơn giá nhập' })
      .min(0, 'Đơn giá không được âm')
      .max(MAX_UNIT_COST, 'Đơn giá quá lớn'),
    condition_note: optionalText(200, 'Tình trạng').prefault(''),
  })
  .superRefine((item, ctx) => {
    if (item.received_qty + item.defective_qty > item.ordered_qty) {
      ctx.addIssue({
        code: 'custom',
        message: 'Thực nhận + lỗi vượt SL theo chứng từ',
        path: ['received_qty'],
      })
    }
  })

/**
 * Phiếu nhập kho (theo Mẫu 01-VT): thông tin nhà cung cấp / chứng từ + các dòng hàng.
 * Mỗi dòng: SL theo chứng từ, SL thực nhận (hàng đạt, được nhập kho), SL lỗi (không nhập kho),
 * đơn giá nhập (chưa VAT) và tình trạng hàng.
 */
export const receiptSchema = z.object({
  supplier_name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập nhà cung cấp')
    .max(200, 'Tên nhà cung cấp tối đa 200 ký tự'),
  supplier_phone: z
    .string()
    .trim()
    .transform((phone) => phone.replace(/[\s.-]/g, ''))
    .refine((phone) => phone === '' || PHONE_PATTERN.test(phone), 'Số điện thoại không hợp lệ')
    .transform((phone) => (phone === '' ? null : phone)),
  invoice_number: optionalText(50, 'Số hóa đơn'),
  delivered_by: optionalText(200, 'Người giao hàng'),
  received_date: z.string().refine(isDateKey, 'Ngày nhập không hợp lệ'),
  note: optionalText(1000, 'Ghi chú'),
  items: z
    .array(receiptItemSchema)
    .min(1, 'Phiếu nhập cần ít nhất một sản phẩm')
    .max(MAX_RECEIPT_ITEMS, `Tối đa ${MAX_RECEIPT_ITEMS} dòng mỗi phiếu`)
    .superRefine((items, ctx) => {
      const seen = new Set<string>()
      items.forEach((item, index) => {
        if (!item.product) return
        if (seen.has(item.product.id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Sản phẩm đã có trên phiếu — gộp số lượng vào dòng trước',
            path: [index, 'product'],
          })
        }
        seen.add(item.product.id)
      })
    }),
})

export type ReceiptFormInput = z.input<typeof receiptSchema>
export type ReceiptFormValues = z.output<typeof receiptSchema>

/** Duyệt nhập kho cần ít nhất một dòng có hàng đạt (RPC báo RECEIPT_NO_RECEIVED nếu không). */
export function hasReceivedGoods(values: Pick<ReceiptFormValues, 'items'>): boolean {
  return values.items.some((item) => item.received_qty > 0)
}

export interface ReceiptPayload {
  header: {
    supplier_name: string
    supplier_phone: string | null
    invoice_number: string | null
    delivered_by: string | null
    received_date: string
    note: string | null
  }
  items: Array<{
    product_id: string
    ordered_qty: number
    received_qty: number
    defective_qty: number
    unit_cost: number
    condition_note: string | null
  }>
}

export function toReceiptPayload(values: ReceiptFormValues): ReceiptPayload {
  const { items, ...header } = values
  return {
    header,
    items: items.flatMap(({ product, ...item }) =>
      product ? [{ product_id: product.id, ...item }] : [],
    ),
  }
}

/** Dòng mới: SL 1 / thực nhận 1; đơn giá được điền sẵn giá vốn hiện tại khi chọn sản phẩm. */
export const EMPTY_RECEIPT_ITEM: ReceiptFormInput['items'][number] = {
  product: null,
  ordered_qty: 1,
  received_qty: 1,
  defective_qty: 0,
  unit_cost: 0,
  condition_note: '',
}
