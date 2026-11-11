import { TIME_ZONE } from './formatters'

/**
 * Ngày lịch dạng `YYYY-MM-DD` ("date key") theo múi giờ cửa hàng — dùng cho bộ lọc khoảng ngày
 * trên URL và tham số RPC. Tính toán trên date key (không qua giờ địa phương của trình duyệt)
 * để không lệch ngày khi người dùng ở múi giờ khác.
 */
export type DateKey = string

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

// en-CA định dạng ngày đúng kiểu YYYY-MM-DD.
const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
})

/** Ngày lịch (theo múi giờ cửa hàng) của một thời điểm. */
export function toDateKey(date: Date): DateKey {
  return keyFormatter.format(date)
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now)
}

/** Chuỗi đúng định dạng và là ngày có thật (loại 2026-02-30). */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function toUtcMs(key: DateKey): number {
  return Date.parse(`${key}T00:00:00Z`)
}

export function addDays(key: DateKey, days: number): DateKey {
  return new Date(toUtcMs(key) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Số ngày trong khoảng [from, to], tính cả hai đầu. */
export function countDays(from: DateKey, to: DateKey): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY) + 1
}

/** Ngày đầu tháng của `key`, lệch `monthOffset` tháng (-1 = tháng trước). */
export function startOfMonth(key: DateKey, monthOffset = 0): DateKey {
  const [year = 0, month = 1] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + monthOffset, 1)).toISOString().slice(0, 10)
}

/** Ngày cuối tháng của `key`, lệch `monthOffset` tháng. */
export function endOfMonth(key: DateKey, monthOffset = 0): DateKey {
  return addDays(startOfMonth(key, monthOffset + 1), -1)
}
