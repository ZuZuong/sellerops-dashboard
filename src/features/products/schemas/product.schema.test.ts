import { describe, expect, it } from 'vitest'
import {
  EMPTY_PRODUCT_FORM,
  MAX_PRICE,
  productSchema,
  type ProductFormInput,
} from './product.schema'

const valid: ProductFormInput = {
  ...EMPTY_PRODUCT_FORM,
  sku: 'at-001',
  name: '  Áo thun basic  ',
  category: '  Áo  ',
  price: 150_000,
  stock: 10,
}

const errorsOf = (input: Partial<Record<keyof ProductFormInput, unknown>>) => {
  const result = productSchema.safeParse({ ...valid, ...input })
  if (result.success) return {}
  // Giữ lỗi đầu tiên của mỗi trường — giống cách form hiển thị (criteriaMode: firstError).
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}

describe('productSchema', () => {
  it('chuẩn hóa: trim, SKU in hoa, danh mục rỗng → null', () => {
    expect(productSchema.parse(valid)).toEqual({
      sku: 'AT-001',
      name: 'Áo thun basic',
      category: 'Áo',
      price: 150_000,
      stock: 10,
      low_stock_threshold: 5,
      is_active: true,
    })
    expect(productSchema.parse({ ...valid, category: '   ' }).category).toBeNull()
  })

  it('bắt buộc SKU và tên (chỉ khoảng trắng cũng tính là trống)', () => {
    expect(errorsOf({ sku: '   ', name: '' })).toEqual({
      sku: 'Vui lòng nhập SKU',
      name: 'Vui lòng nhập tên sản phẩm',
    })
  })

  it('SKU chỉ gồm ký tự cho phép', () => {
    expect(errorsOf({ sku: 'ÁO 01' }).sku).toMatch(/SKU chỉ gồm/)
    expect(errorsOf({ sku: 'A'.repeat(51) }).sku).toBe('SKU tối đa 50 ký tự')
    expect(errorsOf({ sku: 'a.b_c-1' })).toEqual({})
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

  it('ô số bỏ trống báo "Vui lòng nhập"', () => {
    expect(errorsOf({ price: undefined }).price).toBe('Vui lòng nhập giá bán')
  })
})
