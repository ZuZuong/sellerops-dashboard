import { describe, expect, it } from 'vitest'
import {
  buildStocktakeSheet,
  stocktakeToXlsx,
  type StocktakeItem,
} from '@/features/inventory/lib/stocktake'

const item = (overrides: Partial<StocktakeItem>): StocktakeItem => ({
  id: 'p',
  sku: 'SKU',
  name: 'SP',
  category: 'Áo thun',
  unit: 'Cái',
  cost_price: 10_000,
  stock: 1,
  ...overrides,
})

describe('buildStocktakeSheet', () => {
  const sheet = buildStocktakeSheet([
    item({ id: 'a', name: 'Áo thun trắng', category: 'Áo thun', stock: 2, cost_price: 90_000.4 }),
    item({ id: 'b', name: 'Không danh mục', category: null, stock: 0 }),
    item({ id: 'c', name: 'Đầm maxi', category: 'Đầm', stock: 3, cost_price: 200_000 }),
    item({ id: 'd', name: 'Áo thun đen', category: 'Áo thun', stock: 5, cost_price: 80_000 }),
  ])

  it('sắp theo danh mục (tiếng Việt) rồi tên; chưa có danh mục xếp cuối; STT liên tục', () => {
    expect(sheet.lines.map((l) => [l.index, l.id])).toEqual([
      [1, 'd'],
      [2, 'a'],
      [3, 'c'],
      [4, 'b'],
    ])
  })

  it('giữ cả sản phẩm tồn 0 (thực tế có thể còn hàng); thành tiền theo giá vốn', () => {
    expect(sheet.lines.find((l) => l.id === 'b')?.bookQty).toBe(0)
    expect(sheet.lines.find((l) => l.id === 'a')).toMatchObject({
      unitCost: 90_000,
      bookAmount: 180_001,
    })
    expect(sheet.totalQty).toBe(10)
    expect(sheet.totalAmount).toBe(400_000 + 180_001 + 600_000)
  })
})

describe('stocktakeToXlsx', () => {
  it('cột kiểm kê / chênh lệch là công thức theo dòng; dòng cộng dùng SUM', () => {
    const sheet = buildStocktakeSheet([item({ id: 'a' }), item({ id: 'b', name: 'SP 2' })])
    const xlsx = stocktakeToXlsx(sheet, {
      companyName: 'SellerOps',
      bookAsOf: '18/11/2026 09:00',
      scopeLabel: 'tất cả sản phẩm',
    })
    const firstData = xlsx.rows[12] // dòng Excel 13
    expect(firstData?.[7]).toBeNull() // SL kiểm kê để trống cho người đếm nhập
    expect(firstData?.[8]).toEqual({ kind: 'formula', f: 'IF(H13="","",H13*E13)' })
    expect(firstData?.[9]).toEqual({ kind: 'formula', f: 'IF(H13="","",MAX(H13-F13,0))' })
    expect(firstData?.[10]).toEqual({ kind: 'formula', f: 'IF(H13="","",MAX(F13-H13,0))' })
    const total = xlsx.rows[14]
    expect(total?.[0]).toBe('Cộng')
    expect(total?.[7]).toEqual({ kind: 'formula', f: 'SUM(H13:H14)' })
    expect(xlsx.merges).toContain('A15:E15')
  })
})
