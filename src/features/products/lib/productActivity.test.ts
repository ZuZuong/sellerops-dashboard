import { describe, expect, it } from 'vitest'
import { productCreateChanges, productUpdateChanges } from './productActivity'

const base = {
  name: 'Áo thun basic',
  sku: 'DN-AOTHUN-001',
  category: 'Áo thun',
  unit: 'Cái',
  price: 150_000,
  cost_price: 90_000,
  low_stock_threshold: 5,
  is_active: true,
  description: null,
  hero_image_path: 'a/hero.jpg',
  image_paths: ['a/1.jpg'],
}

const norm = (s: string | null) => s?.replace(/\s/g, ' ') ?? null

describe('productActivity', () => {
  it('sửa sản phẩm: liệt kê đúng trường đổi với giá trị cũ → mới đã định dạng', () => {
    const changes = productUpdateChanges(base, {
      ...base,
      name: 'Áo thun basic 2',
      price: 199_000,
      is_active: false,
      image_paths: [],
    })
    expect(changes.map((c) => [c.field, norm(c.from), norm(c.to)])).toEqual([
      ['Tên', 'Áo thun basic', 'Áo thun basic 2'],
      ['Giá bán', '150.000 ₫', '199.000 ₫'],
      ['Trạng thái', 'Đang bán', 'Chưa đăng / ngừng bán'],
      ['Số ảnh', '2 ảnh', '1 ảnh'],
    ])
  })

  it('không đổi gì → danh sách rỗng; thay ảnh đại diện được ghi lại', () => {
    expect(productUpdateChanges(base, { ...base })).toEqual([])
    expect(productUpdateChanges(base, { ...base, hero_image_path: 'a/new.jpg' })).toEqual([
      { field: 'Ảnh đại diện', from: 'Ảnh cũ', to: 'Ảnh mới' },
    ])
  })

  it('tạo sản phẩm: giá trị ban đầu, cũ = trống; bỏ trường không có giá trị', () => {
    const changes = productCreateChanges(base)
    expect(changes[0]).toEqual({ field: 'SKU', from: null, to: 'DN-AOTHUN-001' })
    expect(changes.every((c) => c.from === null)).toBe(true)
    expect(changes.some((c) => c.field === 'Mô tả')).toBe(false)
  })
})
