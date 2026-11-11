import { describe, expect, it } from 'vitest'
import { CSV_BOM } from '@/shared/lib/csv'
import { FALLBACK_ERROR_MESSAGE } from '@/shared/lib/errors'
import {
  buildAdjustNote,
  computeStockDelta,
  createStockAdjustSchema,
  type StockAdjustInput,
} from '../schemas/stockAdjust.schema'
import type { InventoryItem } from '../types'
import { inventoryToCsv } from './inventoryCsv'
import { getInventoryErrorMessage, getMovementReasonLabel } from './inventoryLib'

describe('computeStockDelta', () => {
  it('nhập hàng cộng, xuất hủy trừ, kiểm kê lấy chênh lệch', () => {
    expect(computeStockDelta('import', 10, 5)).toBe(10)
    expect(computeStockDelta('export', 3, 5)).toBe(-3)
    expect(computeStockDelta('count', 2, 5)).toBe(-3)
    expect(computeStockDelta('count', 8, 5)).toBe(3)
  })
})

describe('buildAdjustNote', () => {
  it('ghép loại thao tác với ghi chú', () => {
    expect(buildAdjustNote('import', 'Lô tháng 11')).toBe('Nhập hàng: Lô tháng 11')
    expect(buildAdjustNote('count', null)).toBe('Kiểm kê')
  })
})

describe('createStockAdjustSchema', () => {
  const schema = createStockAdjustSchema(5)
  const issues = (input: StockAdjustInput) => {
    const result = schema.safeParse(input)
    return result.success ? [] : result.error.issues.map((i) => i.message)
  }

  it('hợp lệ: chuẩn hóa ghi chú trống thành null', () => {
    expect(schema.parse({ type: 'import', quantity: 10, note: '  ' })).toEqual({
      type: 'import',
      quantity: 10,
      note: null,
    })
  })

  it('nhập / xuất phải lớn hơn 0; kiểm kê được về 0', () => {
    expect(issues({ type: 'import', quantity: 0, note: '' })).toEqual(['Số lượng phải lớn hơn 0'])
    expect(issues({ type: 'count', quantity: 0, note: '' })).toEqual([])
  })

  it('không xuất quá tồn kho hiện tại', () => {
    expect(issues({ type: 'export', quantity: 6, note: '' })).toEqual([
      'Không thể xuất quá tồn kho hiện tại (5)',
    ])
    expect(issues({ type: 'export', quantity: 5, note: '' })).toEqual([])
  })

  it('kiểm kê bằng số hiện tại → không có gì thay đổi', () => {
    expect(issues({ type: 'count', quantity: 5, note: '' })).toEqual([
      'Tồn kho thực tế bằng tồn kho hiện tại — không có gì thay đổi',
    ])
  })

  it('số lượng phải là số nguyên, ghi chú tối đa 200 ký tự', () => {
    expect(issues({ type: 'import', quantity: 1.5, note: 'x'.repeat(201) })).toEqual([
      'Số lượng phải là số nguyên',
      'Ghi chú tối đa 200 ký tự',
    ])
  })
})

describe('inventory lib', () => {
  it('nhãn lý do biến động', () => {
    expect(getMovementReasonLabel('order_confirmed')).toBe('Xác nhận đơn')
    expect(getMovementReasonLabel('unknown')).toBe('unknown')
  })

  it('map lỗi RPC adjust_stock', () => {
    expect(getInventoryErrorMessage({ code: 'P0001', message: 'INSUFFICIENT_STOCK' })).toMatch(
      /Tồn kho không đủ/,
    )
    expect(getInventoryErrorMessage({ code: 'XX000', message: 'x' })).toBe(FALLBACK_ERROR_MESSAGE)
  })

  it('CSV tồn kho: số thô, nhãn mức tồn, tiếng Việt có BOM', () => {
    const item: InventoryItem = {
      id: 'p1',
      sku: 'DN-AO-001',
      name: 'Áo thun, đỏ',
      category: 'Áo thun',
      unit: 'Cái',
      cost_price: 90_000,
      price: 150_000,
      stock: 2,
      low_stock_threshold: 5,
      is_low_stock: true,
      is_active: true,
    }
    const lines = inventoryToCsv([item]).split('\r\n')
    expect(lines[0]?.startsWith(CSV_BOM)).toBe(true)
    expect(lines[1]).toBe(
      'DN-AO-001,"Áo thun, đỏ",Áo thun,Cái,90000,150000,2,5,180000,300000,Sắp hết,Đang bán',
    )
  })
})
