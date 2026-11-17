import { describe, expect, it } from 'vitest'
import {
  parseSortOption,
  PRODUCT_SORT_OPTIONS,
  productFiltersSchema,
} from './productFilters.schema'

describe('productFiltersSchema', () => {
  it('URL trống → giá trị mặc định', () => {
    expect(productFiltersSchema.parse({})).toEqual({
      q: '',
      category: '',
      status: 'all',
      stock: 'all',
      sort: 'created_at',
      order: 'desc',
      page: 1,
      pageSize: 10,
    })
  })

  it('đọc giá trị hợp lệ từ chuỗi URL (ép kiểu số)', () => {
    expect(
      productFiltersSchema.parse({
        q: '  áo  ',
        category: 'Áo',
        status: 'inactive',
        stock: 'low',
        sort: 'price',
        order: 'asc',
        page: '3',
        pageSize: '50',
      }),
    ).toEqual({
      q: 'áo',
      category: 'Áo',
      status: 'inactive',
      stock: 'low',
      sort: 'price',
      order: 'asc',
      page: 3,
      pageSize: 50,
    })
  })

  it('giá trị không hợp lệ (sửa tay trên URL) rơi về mặc định từng trường', () => {
    const parsed = productFiltersSchema.parse({
      status: 'deleted',
      sort: 'user_id',
      order: 'up',
      page: '-2',
      pageSize: '1000',
      stock: 'low',
    })
    expect(parsed).toMatchObject({
      status: 'all',
      sort: 'created_at',
      order: 'desc',
      page: 1,
      pageSize: 10,
      stock: 'low',
    })
  })

  it('trang không phải số nguyên → trang 1', () => {
    expect(productFiltersSchema.parse({ page: 'abc' }).page).toBe(1)
    expect(productFiltersSchema.parse({ page: '1.5' }).page).toBe(1)
  })
})

describe('ô Sắp xếp', () => {
  it('có đủ chiều tăng / giảm cho tên, giá bán, giá vốn', () => {
    const values = PRODUCT_SORT_OPTIONS.map((o) => o.value)
    for (const field of ['name', 'price', 'cost_price']) {
      expect(values).toContain(`${field}:asc`)
      expect(values).toContain(`${field}:desc`)
    }
  })

  it('parseSortOption tách field / order; giá trị lạ → null', () => {
    expect(parseSortOption('cost_price:asc')).toEqual({ sort: 'cost_price', order: 'asc' })
    expect(parseSortOption('name:desc')).toEqual({ sort: 'name', order: 'desc' })
    expect(parseSortOption('user_id:asc')).toBeNull()
    expect(parseSortOption(null)).toBeNull()
  })

  it('URL sort=cost_price hợp lệ', () => {
    expect(productFiltersSchema.parse({ sort: 'cost_price' }).sort).toBe('cost_price')
  })
})
