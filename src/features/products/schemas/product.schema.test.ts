import { describe, expect, it } from 'vitest'
import { MAX_PRICE, productSchema } from './product.schema'

const valid = {
  name: '  Áo thun basic  ',
  category: 'Áo thun',
  price: 150_000,
  stock: 10,
  low_stock_threshold: 5,
  is_active: true,
}

const errorsOf = (input: Record<string, unknown>) => {
  const result = productSchema.safeParse({ ...valid, ...input })
  if (result.success) return {}
  // Giữ lỗi đầu tiên của mỗi trường — giống cách form hiển thị (criteriaMode: firstError).
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}

describe('productSchema', () => {
  it('chuẩn hóa tên và không chứa SKU (DB tự sinh)', () => {
    const parsed = productSchema.parse({ ...valid, sku: 'TU-NHAP' })
    expect(parsed).toEqual({ ...valid, name: 'Áo thun basic' })
    expect(parsed).not.toHaveProperty('sku')
  })

  it('bắt buộc tên (chỉ khoảng trắng cũng tính là trống)', () => {
    expect(errorsOf({ name: '   ' })).toEqual({ name: 'Vui lòng nhập tên sản phẩm' })
  })

  it('danh mục phải chọn từ danh sách thời trang', () => {
    expect(errorsOf({ category: undefined }).category).toBe('Vui lòng chọn danh mục')
    expect(errorsOf({ category: 'Điện thoại' }).category).toBe('Vui lòng chọn danh mục')
    expect(errorsOf({ category: 'Đầm' })).toEqual({})
  })

  it('giá bắt buộc; bỏ trống tồn kho ban đầu = 0', () => {
    expect(errorsOf({ price: undefined }).price).toBe('Vui lòng nhập giá bán')
    expect(productSchema.parse({ ...valid, stock: undefined }).stock).toBe(0)
  })

  it('giá, tồn kho, ngưỡng: số nguyên không âm', () => {
    expect(errorsOf({ price: -1 }).price).toBe('Giá bán không được âm')
    expect(errorsOf({ price: 10.5 }).price).toBe('Giá bán phải là số nguyên')
    expect(errorsOf({ price: MAX_PRICE + 1 }).price).toBe('Giá bán quá lớn')
    expect(errorsOf({ stock: -3 }).stock).toBe('Tồn kho không được âm')
    expect(errorsOf({ low_stock_threshold: -1 }).low_stock_threshold).toBe(
      'Ngưỡng cảnh báo không được âm',
    )
    expect(errorsOf({ price: 0, stock: 0, low_stock_threshold: 0 })).toEqual({})
  })
})
