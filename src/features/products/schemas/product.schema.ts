import { z } from 'zod'
import { PRODUCT_CATEGORIES } from '../constants'

/** Giới hạn theo cột `numeric(12, 0)` trong DB. */
export const MAX_PRICE = 999_999_999_999
/** Giới hạn theo cột `int` (int4) trong DB. */
export const MAX_INT = 2_147_483_647

const nonNegativeInt = (label: string, max: number) =>
  z
    .number({ error: `Vui lòng nhập ${label.toLowerCase()}` })
    .int(`${label} phải là số nguyên`)
    .min(0, `${label} không được âm`)
    .max(max, `${label} quá lớn`)

export const priceSchema = nonNegativeInt('Giá bán', MAX_PRICE)
export const stockSchema = nonNegativeInt('Tồn kho', MAX_INT)

/**
 * Form sản phẩm. SKU không có ở đây: DB tự sinh khi tạo (xem migration `auto_product_sku`).
 * `is_active` không có ô nhập — do nút bấm quyết định ("Đăng sản phẩm" / "Thêm sản phẩm").
 */
export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên sản phẩm')
    .max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  category: z.enum(PRODUCT_CATEGORIES, { error: 'Vui lòng chọn danh mục' }),
  price: priceSchema,
  // Bỏ trống tồn kho ban đầu = 0.
  stock: stockSchema.default(0),
  low_stock_threshold: nonNegativeInt('Ngưỡng cảnh báo', MAX_INT),
  is_active: z.boolean(),
})

/** Giá trị trong form (trước khi chuẩn hóa) — ô số có thể đang trống. */
export type ProductFormInput = z.input<typeof productSchema>
/** Giá trị đã chuẩn hóa gửi lên API. */
export type ProductFormValues = z.output<typeof productSchema>

/** Form trống: giá / tồn kho để trống (không điền sẵn 0), danh mục chưa chọn. */
export const EMPTY_PRODUCT_FORM: Partial<ProductFormInput> = {
  name: '',
  low_stock_threshold: 5,
  is_active: true,
}
