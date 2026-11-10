import { z } from 'zod'

/** Khoảng thời gian của trang Tổng quan, lưu trên URL (`?range=7d`). */
export const DASHBOARD_RANGES = ['7d', '30d'] as const

export const dashboardRangeSchema = z.enum(DASHBOARD_RANGES)
export type DashboardRange = z.infer<typeof dashboardRangeSchema>

export const DEFAULT_DASHBOARD_RANGE: DashboardRange = '30d'

export const RANGE_DAYS: Readonly<Record<DashboardRange, number>> = { '7d': 7, '30d': 30 }

/** Giá trị lạ / thiếu trên URL rơi về mặc định thay vì làm hỏng trang. */
export function parseDashboardRange(value: string | null): DashboardRange {
  const parsed = dashboardRangeSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_DASHBOARD_RANGE
}
