import { describe, expect, it } from 'vitest'
import {
  importProductSchema,
  MAX_PRICE,
  productSchema,
} from '@/features/products/schemas/product.schema'

const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001'

const valid = {
  name: '  Áo thun basic  ',
  category_id: CATEGORY_ID,
  unit: 'Cái',
  cost_price: 90_000,
  price: 150_000,
  stock: 10,
  low_stock_threshold: 5,
  description: '  Cotton 100%  ',
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
    expect(parsed).toEqual({ ...valid, name: 'Áo thun basic', description: 'Cotton 100%' })
    expect(parsed).not.toHaveProperty('sku')
  })

  it('mô tả: bỏ trống → null, giới hạn độ dài', () => {
    expect(productSchema.parse({ ...valid, description: '   ' }).description).toBeNull()
    expect(productSchema.parse({ ...valid, description: undefined }).description).toBeNull()
    expect(errorsOf({ description: 'a'.repeat(5001) }).description).toBe('Mô tả tối đa 5000 ký tự')
  })

  it('bắt buộc tên (chỉ khoảng trắng cũng tính là trống)', () => {
    expect(errorsOf({ name: '   ' })).toEqual({ name: 'Vui lòng nhập tên sản phẩm' })
  })

  it('danh mục bắt buộc, là id danh mục của shop (khóa ngoại kiểm tra lại ở DB)', () => {
    expect(errorsOf({ category_id: undefined }).category_id).toBe('Vui lòng chọn danh mục')
    expect(errorsOf({ category_id: 'Áo thun' }).category_id).toBe('Vui lòng chọn danh mục')
    expect(errorsOf({ category_id: CATEGORY_ID })).toEqual({})
  })

  it('dòng Excel: danh mục ghi bằng tên, bắt buộc, tối đa 50 ký tự', () => {
    const row = {
      name: valid.name,
      unit: valid.unit,
      cost_price: valid.cost_price,
      price: valid.price,
      stock: valid.stock,
      low_stock_threshold: valid.low_stock_threshold,
      description: valid.description,
    }
    const parse = (category: unknown) => importProductSchema.safeParse({ ...row, category })
    expect(parse('  Đầm ').data?.category).toBe('Đầm')
    expect(parse('   ').error?.issues[0]?.message).toBe('Vui lòng nhập danh mục')
    expect(parse('x'.repeat(51)).error?.issues[0]?.message).toBe('Tên danh mục tối đa 50 ký tự')
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

  it('đơn vị tính chọn từ danh sách; giá vốn bắt buộc, số nguyên không âm', () => {
    expect(errorsOf({ unit: 'Thùng' }).unit).toBe('Vui lòng chọn đơn vị tính')
    expect(errorsOf({ cost_price: undefined }).cost_price).toBe('Vui lòng nhập giá vốn')
    expect(errorsOf({ cost_price: -1 }).cost_price).toBe('Giá vốn không được âm')
    // Giá bán thấp hơn giá vốn vẫn hợp lệ (xả hàng) — form chỉ cảnh báo.
    expect(errorsOf({ cost_price: 200_000, price: 150_000 })).toEqual({})
  })
})
