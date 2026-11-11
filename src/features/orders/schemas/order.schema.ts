import { z } from 'zod'

/** Giới hạn theo cột `int` (int4) trong DB. */
export const MAX_QUANTITY = 100_000
/** Giới hạn số dòng hàng một đơn (RPC `create_order` từ chối nếu vượt). */
export const MAX_ORDER_ITEMS = 50

/** Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx (9 số sau đầu số). */
const PHONE_PATTERN = /^(?:\+84|0)\d{9}$/

const orderItemSchema = z.object({
  // Giữ thông tin sản phẩm đã chọn để hiện giá / tồn kho; chỉ product_id được gửi lên server.
  product: z
    .object({
      id: z.string(),
      name: z.string(),
      sku: z.string(),
      price: z.number(),
      stock: z.number(),
    })
    .nullable()
    .refine((product) => product !== null, 'Vui lòng chọn sản phẩm'),
  quantity: z
    .number({ error: 'Nhập số lượng' })
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu là 1')
    .max(MAX_QUANTITY, 'Số lượng quá lớn'),
})

/**
 * Form tạo đơn. Giá trong form chỉ để hiển thị / tính tạm tổng tiền: server chốt `unit_price`
 * theo giá hiện tại của sản phẩm tại thời điểm tạo đơn.
 */
export const createOrderSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên khách hàng')
    .max(200, 'Tên khách hàng tối đa 200 ký tự'),
  customer_phone: z
    .string()
    .trim()
    .transform((phone) => phone.replace(/[\s.-]/g, ''))
    .refine((phone) => phone === '' || PHONE_PATTERN.test(phone), 'Số điện thoại không hợp lệ')
    .transform((phone) => (phone === '' ? null : phone)),
  items: z
    .array(orderItemSchema)
    .min(1, 'Đơn hàng cần ít nhất một sản phẩm')
    .max(MAX_ORDER_ITEMS, `Tối đa ${MAX_ORDER_ITEMS} sản phẩm mỗi đơn`)
    .superRefine((items, ctx) => {
      const seen = new Set<string>()
      items.forEach((item, index) => {
        if (!item.product) return
        if (seen.has(item.product.id)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Sản phẩm đã có trong đơn — hãy tăng số lượng ở dòng trước',
            path: [index, 'product'],
          })
        }
        seen.add(item.product.id)
      })
    }),
})

export type CreateOrderInput = z.input<typeof createOrderSchema>
export type CreateOrderValues = z.output<typeof createOrderSchema>

/** Payload gửi RPC `create_order`. */
export interface CreateOrderPayload {
  customer_name: string
  customer_phone: string | null
  items: Array<{ product_id: string; quantity: number }>
}

export function toCreateOrderPayload(values: CreateOrderValues): CreateOrderPayload {
  return {
    customer_name: values.customer_name,
    customer_phone: values.customer_phone,
    items: values.items.flatMap(({ product, quantity }) =>
      product ? [{ product_id: product.id, quantity }] : [],
    ),
  }
}

export const EMPTY_ORDER_ITEM: CreateOrderInput['items'][number] = {
  product: null,
  quantity: 1,
}

export const EMPTY_ORDER_FORM: CreateOrderInput = {
  customer_name: '',
  customer_phone: '',
  items: [EMPTY_ORDER_ITEM],
}
