import { describe, expect, it } from 'vitest'
import { createOrderSchema, toCreateOrderPayload, type CreateOrderInput } from './order.schema'

const product = (id: string, price = 100_000) => ({
  id,
  name: `SP ${id}`,
  sku: `DN-SP-${id}`,
  price,
  stock: 10,
})

const valid: CreateOrderInput = {
  customer_name: '  Nguyễn Văn A ',
  customer_phone: '090 123 4567',
  items: [
    { product: product('p1'), quantity: 2 },
    { product: product('p2'), quantity: 1 },
  ],
}

const issues = (input: CreateOrderInput) => {
  const result = createOrderSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message])
}

describe('createOrderSchema', () => {
  it('chuẩn hóa tên / SĐT và tạo payload chỉ gồm product_id + quantity', () => {
    const values = createOrderSchema.parse(valid)
    expect(toCreateOrderPayload(values)).toEqual({
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0901234567',
      items: [
        { product_id: 'p1', quantity: 2 },
        { product_id: 'p2', quantity: 1 },
      ],
    })
  })

  it('SĐT bỏ trống → null; chấp nhận +84', () => {
    expect(createOrderSchema.parse({ ...valid, customer_phone: '' }).customer_phone).toBeNull()
    expect(
      createOrderSchema.parse({ ...valid, customer_phone: '+84901234567' }).customer_phone,
    ).toBe('+84901234567')
  })

  it('báo lỗi tên trống, SĐT sai định dạng', () => {
    expect(issues({ ...valid, customer_name: '  ', customer_phone: '12345' })).toEqual([
      ['customer_name', 'Vui lòng nhập tên khách hàng'],
      ['customer_phone', 'Số điện thoại không hợp lệ'],
    ])
  })

  it('đơn phải có ít nhất một sản phẩm', () => {
    expect(issues({ ...valid, items: [] })).toEqual([
      ['items', 'Đơn hàng cần ít nhất một sản phẩm'],
    ])
  })

  it('mỗi dòng phải chọn sản phẩm và số lượng ≥ 1 nguyên', () => {
    expect(
      issues({
        ...valid,
        items: [
          { product: null, quantity: 1 },
          { product: product('p1'), quantity: 0 },
          { product: product('p2'), quantity: 1.5 },
        ],
      }),
    ).toEqual([
      ['items.0.product', 'Vui lòng chọn sản phẩm'],
      ['items.1.quantity', 'Số lượng tối thiểu là 1'],
      ['items.2.quantity', 'Số lượng phải là số nguyên'],
    ])
  })

  it('không cho chọn trùng sản phẩm', () => {
    expect(
      issues({
        ...valid,
        items: [
          { product: product('p1'), quantity: 1 },
          { product: product('p1'), quantity: 2 },
        ],
      }),
    ).toEqual([['items.1.product', 'Sản phẩm đã có trong đơn — hãy tăng số lượng ở dòng trước']])
  })
})
