/**
 * Định dạng hiển thị dùng chung (tiền, số, ngày). Mọi nơi trong app chỉ format qua đây
 * để thống nhất locale/múi giờ.
 */

export const LOCALE = 'vi-VN'
export const TIME_ZONE = 'Asia/Ho_Chi_Minh'

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

const shareFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TIME_ZONE,
})

/** 1250000 → "1.250.000 ₫" */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

/** 1250000 → "1,3 Tr ₫" – dùng cho trục biểu đồ, nơi chật chỗ. */
export function formatCompactCurrency(value: number): string {
  return `${compactCurrencyFormatter.format(value)} ₫`
}

/** 12345 → "12.345" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** Tỉ lệ dạng thập phân: 0.125 → "+12,5%", -0.5 → "-50%", 0 → "0%". */
export function formatPercentChange(ratio: number): string {
  return percentFormatter.format(ratio)
}

/** Tỉ trọng dạng thập phân: 0.755 → "75,5%". */
export function formatPercent(ratio: number): string {
  return shareFormatter.format(ratio)
}

/**
 * Chuỗi ngày thuần `YYYY-MM-DD` (không có giờ) được hiểu là nửa đêm theo múi giờ cửa hàng,
 * tránh lệch một ngày khi trình duyệt ở múi giờ khác.
 */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+07:00`)
  return new Date(value)
}

/** → "05/11/2026" */
export function formatDate(value: string | Date): string {
  return dateFormatter.format(toDate(value))
}

/** → "05/11" */
export function formatShortDate(value: string | Date): string {
  // ICU định dạng "ngày-tháng" của vi-VN là "05-11"; ghép tay để thống nhất "05/11" với formatDate.
  const parts = dateFormatter.formatToParts(toDate(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${get('day')}/${get('month')}`
}

/** → "05/11/2026 14:30" */
export function formatDateTime(value: string | Date): string {
  const date = toDate(value)
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`
}
