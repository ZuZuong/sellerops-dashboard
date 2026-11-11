import { describe, expect, it } from 'vitest'
import { calcChange, calcMargin, getTrend } from './metrics'

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

describe('calcMargin', () => {
  it('lợi nhuận / doanh thu; không có doanh thu → null', () => {
    expect(calcMargin(30, 100)).toBe(0.3)
    expect(calcMargin(-10, 100)).toBe(-0.1)
    expect(calcMargin(0, 0)).toBeNull()
  })
})
