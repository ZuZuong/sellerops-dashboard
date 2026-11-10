import { describe, expect, it } from 'vitest'
import { productFiltersSchema } from './productFilters.schema'

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
