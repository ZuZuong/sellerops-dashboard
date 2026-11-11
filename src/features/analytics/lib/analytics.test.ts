import { describe, expect, it } from 'vitest'
import { CSV_BOM } from '@/shared/lib/csv'
import { resolveRange } from '../schemas/analyticsRange.schema'
import { averageOrderValue, foldCategories, revenueToCsv } from './analytics'

const TODAY = '2026-11-11'

describe('resolveRange', () => {
  it('preset tính tương đối theo hôm nay', () => {
    expect(resolveRange({ range: '7d', from: '', to: '' }, TODAY)).toEqual({
      from: '2026-11-05',
      to: TODAY,
      days: 7,
      preset: '7d',
    })
    expect(resolveRange({ range: 'this-month', from: '', to: '' }, TODAY)).toMatchObject({
      from: '2026-11-01',
      to: TODAY,
      days: 11,
    })
    expect(resolveRange({ range: 'last-month', from: '', to: '' }, TODAY)).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      days: 31,
    })
  })

  it('khoảng tùy chọn hợp lệ giữ nguyên', () => {
    expect(resolveRange({ range: 'custom', from: '2026-09-01', to: '2026-09-15' }, TODAY)).toEqual({
      from: '2026-09-01',
      to: '2026-09-15',
      days: 15,
      preset: 'custom',
    })
  })

  it('URL sửa tay sai: ngày lỗi → 30 ngày tới "to", tương lai → hôm nay, ngược → đổi chỗ', () => {
    expect(resolveRange({ range: 'custom', from: 'abc', to: '' }, TODAY)).toMatchObject({
      from: '2026-10-13',
      to: TODAY,
    })
    expect(
      resolveRange({ range: 'custom', from: '2026-11-01', to: '2027-01-01' }, TODAY),
    ).toMatchObject({ from: '2026-11-01', to: TODAY })
    expect(
      resolveRange({ range: 'custom', from: '2026-10-20', to: '2026-10-10' }, TODAY),
    ).toMatchObject({ from: '2026-10-10', to: '2026-10-20' })
  })

  it('khoảng dài hơn 366 ngày bị cắt bớt đầu', () => {
    expect(
      resolveRange({ range: 'custom', from: '2024-01-01', to: '2026-11-10' }, TODAY),
    ).toMatchObject({ from: '2025-11-10', to: '2026-11-10', days: 366 })
  })
})

describe('foldCategories', () => {
  it('sắp giảm dần, tính tỉ trọng, đặt tên cho danh mục trống', () => {
    expect(
      foldCategories([
        { category: 'Áo thun', revenue: 100, quantity: 2 },
        { category: null, revenue: 300, quantity: 1 },
      ]),
    ).toEqual([
      { label: 'Chưa phân loại', revenue: 300, quantity: 1, share: 0.75 },
      { label: 'Áo thun', revenue: 100, quantity: 2, share: 0.25 },
    ])
  })

  it('gộp danh mục nhỏ vào "Khác" khi vượt số cột tối đa', () => {
    const rows = ['A', 'B', 'C', 'D'].map((category, i) => ({
      category,
      revenue: 40 - i * 10,
      quantity: 1,
    }))
    expect(foldCategories(rows, 3).map((s) => [s.label, s.revenue, s.quantity])).toEqual([
      ['A', 40, 1],
      ['B', 30, 1],
      ['Khác', 30, 2],
    ])
  })

  it('không có doanh thu → mảng rỗng', () => {
    expect(foldCategories([])).toEqual([])
  })
})

describe('averageOrderValue', () => {
  it('làm tròn, không chia cho 0', () => {
    expect(averageOrderValue(1_000_000, 3)).toBe(333_333)
    expect(averageOrderValue(0, 0)).toBe(0)
  })
})

describe('revenueToCsv', () => {
  it('BOM + ngày ISO + số thô', () => {
    expect(
      revenueToCsv([
        { day: '2026-11-01', revenue: 1_250_000, order_count: 3 },
        { day: '2026-11-02', revenue: 0, order_count: 0 },
      ]),
    ).toBe(`${CSV_BOM}Ngày,Doanh thu (VND),Số đơn\r\n2026-11-01,1250000,3\r\n2026-11-02,0,0\r\n`)
  })
})
