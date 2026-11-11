import { describe, expect, it } from 'vitest'
import { CSV_BOM } from '@/shared/lib/csv'
import { resolveRange } from '../schemas/analyticsRange.schema'
import {
  averageOrderValue,
  foldCategories,
  revenueToCsv,
  stockLedgerToCsv,
  stockLedgerTotals,
} from './analytics'

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
        { category: 'Áo thun', revenue: 100, gross_profit: 40, quantity: 2 },
        { category: null, revenue: 300, gross_profit: 90, quantity: 1 },
      ]),
    ).toEqual([
      { label: 'Chưa phân loại', revenue: 300, gross_profit: 90, quantity: 1, share: 0.75 },
      { label: 'Áo thun', revenue: 100, gross_profit: 40, quantity: 2, share: 0.25 },
    ])
  })

  it('gộp danh mục nhỏ vào "Khác" khi vượt số cột tối đa', () => {
    const rows = ['A', 'B', 'C', 'D'].map((category, i) => ({
      category,
      revenue: 40 - i * 10,
      gross_profit: 10,
      quantity: 1,
    }))
    expect(
      foldCategories(rows, 3).map((s) => [s.label, s.revenue, s.gross_profit, s.quantity]),
    ).toEqual([
      ['A', 40, 10, 1],
      ['B', 30, 10, 1],
      ['Khác', 30, 20, 2],
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
        {
          day: '2026-11-01',
          revenue: 1_250_000,
          cogs: 800_000,
          gross_profit: 450_000,
          order_count: 3,
        },
        { day: '2026-11-02', revenue: 0, cogs: 0, gross_profit: 0, order_count: 0 },
      ]),
    ).toBe(
      `${CSV_BOM}Ngày,Doanh thu (VND),Giá vốn hàng bán (VND),Lợi nhuận gộp (VND),Số đơn\r\n` +
        '2026-11-01,1250000,800000,450000,3\r\n2026-11-02,0,0,0,0\r\n',
    )
  })
})

describe('stock ledger (xuất nhập tồn)', () => {
  const rows = [
    {
      product_id: 'p1',
      sku: 'DN-AO-001',
      name: 'Áo thun',
      unit: 'Cái',
      opening_qty: 10,
      opening_value: 900_000,
      in_qty: 20,
      in_value: 2_100_000,
      out_qty: 5,
      out_value: 500_000,
      closing_qty: 25,
      closing_value: 2_500_000,
    },
    {
      product_id: 'p2',
      sku: 'DN-GIAY-002',
      name: 'Giày',
      unit: 'Đôi',
      opening_qty: 0,
      opening_value: 0,
      in_qty: 4,
      in_value: 1_280_000,
      out_qty: 1,
      out_value: 320_000,
      closing_qty: 3,
      closing_value: 960_000,
    },
  ]

  it('cộng giá trị các cột', () => {
    expect(stockLedgerTotals(rows)).toEqual({
      opening_value: 900_000,
      in_qty: 24,
      in_value: 3_380_000,
      out_qty: 6,
      out_value: 820_000,
      closing_value: 3_460_000,
    })
  })

  it('CSV có đủ SL + giá trị tồn đầu / nhập / xuất / tồn cuối', () => {
    const [header, first] = stockLedgerToCsv(rows).replace(CSV_BOM, '').split('\r\n')
    expect(header).toContain('Tồn đầu kỳ - SL,Tồn đầu kỳ - Giá trị (VND)')
    expect(first).toBe('DN-AO-001,Áo thun,Cái,10,900000,20,2100000,5,500000,25,2500000')
  })
})
