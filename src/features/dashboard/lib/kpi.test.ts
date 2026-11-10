import { describe, expect, it } from 'vitest'
import { calcChange, getTrend, summarizeSeries } from './kpi'

describe('calcChange', () => {
  it('tính tỉ lệ tăng / giảm so với kỳ trước', () => {
    expect(calcChange(150, 100)).toBe(0.5)
    expect(calcChange(50, 100)).toBe(-0.5)
    expect(calcChange(100, 100)).toBe(0)
    expect(calcChange(0, 100)).toBe(-1)
  })

  it('trả null khi kỳ trước bằng 0 (không chia cho 0)', () => {
    expect(calcChange(100, 0)).toBeNull()
    expect(calcChange(0, 0)).toBeNull()
  })

  it('trả null với dữ liệu không hợp lệ', () => {
    expect(calcChange(Number.NaN, 100)).toBeNull()
    expect(calcChange(100, -5)).toBeNull()
  })
})

describe('getTrend', () => {
  it('phân loại xu hướng', () => {
    expect(getTrend(0.1)).toBe('up')
    expect(getTrend(-0.1)).toBe('down')
    expect(getTrend(0)).toBe('flat')
    expect(getTrend(null)).toBeNull()
  })
})

describe('summarizeSeries', () => {
  it('cộng dồn doanh thu và số đơn', () => {
    expect(
      summarizeSeries([
        { revenue: 100_000, order_count: 1 },
        { revenue: 0, order_count: 0 },
        { revenue: 250_000, order_count: 2 },
      ]),
    ).toEqual({ revenue: 350_000, orderCount: 3 })
  })

  it('chuỗi rỗng trả 0', () => {
    expect(summarizeSeries([])).toEqual({ revenue: 0, orderCount: 0 })
  })
})
