import { z } from 'zod'
import {
  addDays,
  countDays,
  endOfMonth,
  isDateKey,
  startOfMonth,
  type DateKey,
} from '@/shared/lib/dates'

export const RANGE_PRESETS = ['7d', '30d', '90d', 'this-month', 'last-month'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export const RANGE_PRESET_LABELS: Readonly<Record<RangePreset, string>> = {
  '7d': '7 ngày',
  '30d': '30 ngày',
  '90d': '90 ngày',
  'this-month': 'Tháng này',
  'last-month': 'Tháng trước',
}

/** Giới hạn của RPC báo cáo (INVALID_RANGE nếu vượt). */
export const MAX_RANGE_DAYS = 366

/**
 * Khoảng thời gian báo cáo trên URL. Preset lưu dạng tương đối (`?range=30d`) để link chia sẻ
 * luôn là "30 ngày gần nhất"; khoảng tùy chọn lưu `?range=custom&from=…&to=…`.
 */
export const analyticsRangeSchema = z.object({
  range: z.enum([...RANGE_PRESETS, 'custom']).catch('30d'),
  from: z.string().trim().max(10).catch(''),
  to: z.string().trim().max(10).catch(''),
})

export type AnalyticsRangeParams = z.infer<typeof analyticsRangeSchema>

export interface ResolvedRange {
  from: DateKey
  to: DateKey
  days: number
  preset: RangePreset | 'custom'
}

export function presetRange(preset: RangePreset, today: DateKey): { from: DateKey; to: DateKey } {
  switch (preset) {
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case '90d':
      return { from: addDays(today, -89), to: today }
    case 'this-month':
      return { from: startOfMonth(today), to: today }
    case 'last-month':
      return { from: startOfMonth(today, -1), to: endOfMonth(today, -1) }
  }
}

/**
 * Chuyển tham số URL thành khoảng ngày hợp lệ (URL có thể bị sửa tay):
 * ngày sai → mặc định 30 ngày; ngày tương lai → hôm nay; from > to → đổi chỗ;
 * dài hơn 366 ngày → cắt bớt đầu khoảng.
 */
export function resolveRange(params: AnalyticsRangeParams, today: DateKey): ResolvedRange {
  if (params.range !== 'custom') {
    const { from, to } = presetRange(params.range, today)
    return { from, to, days: countDays(from, to), preset: params.range }
  }

  let to = isDateKey(params.to) && params.to <= today ? params.to : today
  let from = isDateKey(params.from) && params.from <= today ? params.from : addDays(to, -29)
  if (from > to) [from, to] = [to, from]
  if (countDays(from, to) > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1))
  return { from, to, days: countDays(from, to), preset: 'custom' }
}
