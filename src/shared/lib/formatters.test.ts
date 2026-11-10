import { describe, expect, it } from 'vitest'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercentChange,
  formatShortDate,
} from './formatters'

/** Intl dùng khoảng trắng không ngắt (U+00A0); chuẩn hóa để so sánh dễ đọc. */
const normalize = (s: string) => s.replace(/\s/g, ' ')

describe('formatters', () => {
  it('formatCurrency: VND, phân tách hàng nghìn bằng dấu chấm, không có phần lẻ', () => {
    expect(normalize(formatCurrency(1_250_000))).toBe('1.250.000 ₫')
    expect(normalize(formatCurrency(0))).toBe('0 ₫')
  })

  it('formatCompactCurrency: rút gọn cho trục biểu đồ', () => {
    expect(normalize(formatCompactCurrency(1_250_000))).toBe('1,3 Tr ₫')
    expect(normalize(formatCompactCurrency(950_000))).toBe('950 N ₫')
  })

  it('formatNumber', () => {
    expect(formatNumber(12_345)).toBe('12.345')
  })

  it('formatPercentChange: có dấu cho tăng/giảm, không dấu khi bằng 0', () => {
    expect(formatPercentChange(0.125)).toBe('+12,5%')
    expect(formatPercentChange(-0.5)).toBe('-50%')
    expect(formatPercentChange(0)).toBe('0%')
  })

  it('formatDate / formatShortDate hiểu YYYY-MM-DD là ngày theo giờ Việt Nam', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2026')
    expect(formatShortDate('2026-11-05')).toBe('05/11')
  })

  it('formatDateTime đổi timestamp UTC sang giờ Việt Nam', () => {
    expect(formatDateTime('2026-11-05T07:30:00Z')).toBe('05/11/2026 14:30')
    // 20:00 UTC đã sang ngày hôm sau ở UTC+7
    expect(formatDateTime('2026-11-05T20:00:00Z')).toBe('06/11/2026 03:00')
  })
})
