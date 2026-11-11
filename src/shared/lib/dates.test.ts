import { describe, expect, it } from 'vitest'
import {
  addDays,
  countDays,
  endOfMonth,
  isDateKey,
  startOfMonth,
  toDateKey,
  todayKey,
} from './dates'

describe('dates', () => {
  it('lấy ngày theo múi giờ cửa hàng (UTC+7), không theo giờ trình duyệt', () => {
    // 18:30 UTC ngày 10 = 01:30 sáng ngày 11 ở Việt Nam
    expect(toDateKey(new Date('2026-11-10T18:30:00Z'))).toBe('2026-11-11')
    expect(todayKey(new Date('2026-11-10T16:59:00Z'))).toBe('2026-11-10')
  })

  it('kiểm tra date key hợp lệ', () => {
    expect(isDateKey('2026-02-28')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-2-1')).toBe(false)
    expect(isDateKey(undefined)).toBe(false)
  })

  it('cộng / trừ ngày qua ranh giới tháng, năm', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('đếm số ngày tính cả hai đầu', () => {
    expect(countDays('2026-11-01', '2026-11-30')).toBe(30)
    expect(countDays('2026-11-05', '2026-11-05')).toBe(1)
  })

  it('đầu / cuối tháng', () => {
    expect(startOfMonth('2026-11-11')).toBe('2026-11-01')
    expect(startOfMonth('2026-01-15', -1)).toBe('2025-12-01')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2026-03-10', -1)).toBe('2026-02-28')
  })
})
