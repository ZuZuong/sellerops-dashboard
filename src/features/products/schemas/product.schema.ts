import { z } from 'zod'

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

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập SKU')
    .max(50, 'SKU tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9._-]+$/, 'SKU chỉ gồm chữ không dấu, số và các ký tự - _ .')
    .transform((sku) => sku.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên sản phẩm')
    .max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  category: z
    .string()
    .trim()
    .max(100, 'Danh mục tối đa 100 ký tự')
    .transform((category) => (category === '' ? null : category)),
  price: priceSchema,
  stock: stockSchema,
  low_stock_threshold: nonNegativeInt('Ngưỡng cảnh báo', MAX_INT),
  is_active: z.boolean(),
})

/** Giá trị trong form (trước khi chuẩn hóa). */
export type ProductFormInput = z.input<typeof productSchema>
/** Giá trị đã chuẩn hóa gửi lên API (SKU in hoa, danh mục rỗng → null). */
export type ProductFormValues = z.output<typeof productSchema>

export const EMPTY_PRODUCT_FORM: ProductFormInput = {
  sku: '',
  name: '',
  category: '',
  price: 0,
  stock: 0,
  low_stock_threshold: 5,
  is_active: true,
}
