import { z } from 'zod'
import { DEFAULT_PRODUCT_UNIT, PRODUCT_CATEGORIES, PRODUCT_UNITS } from '../constants'

/** Giới hạn theo cột `numeric(12, 0)` trong DB. */
export const MAX_PRICE = 999_999_999_999
/** Giới hạn theo cột `int` (int4) trong DB. */
export const MAX_INT = 2_147_483_647
/** Giới hạn theo CHECK của cột `description`. */
export const MAX_DESCRIPTION = 5000
export const DEFAULT_LOW_STOCK_THRESHOLD = 5

const nonNegativeInt = (label: string, max: number) =>
  z
    .number({ error: `Vui lòng nhập ${label.toLowerCase()}` })
    .int(`${label} phải là số nguyên`)
    .min(0, `${label} không được âm`)
    .max(max, `${label} quá lớn`)

export const priceSchema = nonNegativeInt('Giá bán', MAX_PRICE)
export const costPriceSchema = nonNegativeInt('Giá vốn', MAX_PRICE)
export const stockSchema = nonNegativeInt('Tồn kho', MAX_INT)
const thresholdSchema = nonNegativeInt('Ngưỡng cảnh báo', MAX_INT)

const descriptionSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION, `Mô tả tối đa ${MAX_DESCRIPTION} ký tự`)
  .transform((description) => (description === '' ? null : description))

/**
 * Form sản phẩm. SKU không có ở đây: DB tự sinh khi tạo (xem migration `auto_product_sku`).
 * `is_active` không có ô nhập — do nút bấm quyết định ("Đăng sản phẩm" / "Thêm sản phẩm").
 * Ảnh là file nên quản lý riêng (xem `lib/productImages.ts`), không nằm trong schema.
 */
export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên sản phẩm')
    .max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  category: z.enum(PRODUCT_CATEGORIES, { error: 'Vui lòng chọn danh mục' }),
  unit: z.enum(PRODUCT_UNITS, { error: 'Vui lòng chọn đơn vị tính' }),
  /** Giá vốn 1 đơn vị (giá nhập). Khi sửa: giá vốn bình quân hiện tại, phiếu nhập kho tự cập nhật. */
  cost_price: costPriceSchema,
  price: priceSchema,
  // Bỏ trống tồn kho ban đầu = 0.
  stock: stockSchema.default(0),
  low_stock_threshold: thresholdSchema,
  // prefault: ô trống vẫn đi qua transform ('' → null), khác default (bỏ qua transform).
  description: descriptionSchema.prefault(''),
  is_active: z.boolean(),
})

/** Giá trị trong form (trước khi chuẩn hóa) — ô số có thể đang trống. */
export type ProductFormInput = z.input<typeof productSchema>
/** Giá trị đã chuẩn hóa gửi lên API. */
export type ProductFormValues = z.output<typeof productSchema>

/** Form trống: giá / tồn kho để trống (không điền sẵn 0), danh mục chưa chọn. */
export const EMPTY_PRODUCT_FORM: Partial<ProductFormInput> = {
  name: '',
  unit: DEFAULT_PRODUCT_UNIT,
  low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
  description: '',
  is_active: true,
}

/** Một dòng trong file Excel nhập sản phẩm: ngưỡng cảnh báo không bắt buộc, không có ảnh. */
export const importProductSchema = productSchema.omit({ is_active: true }).extend({
  low_stock_threshold: thresholdSchema.default(DEFAULT_LOW_STOCK_THRESHOLD),
})

export type ImportedProduct = z.output<typeof importProductSchema>
