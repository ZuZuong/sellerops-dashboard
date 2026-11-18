import type { ActivityChange } from '@/shared/lib/activityChanges'
import type { Tables } from '@/shared/types/database.types'

export const ACTIVITY_LEVELS = ['success', 'error', 'warning', 'info'] as const
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]

export type ActivityLog = Omit<
  Pick<
    Tables<'activity_logs'>,
    'id' | 'level' | 'title' | 'message' | 'path' | 'created_at' | 'read_at'
  >,
  'level'
> & { level: ActivityLevel; changes: ActivityChange[] }

/** Dữ liệu ghi một dòng nhật ký (user_id / thời điểm do DB gán). */
export interface ActivityInput {
  level: ActivityLevel
  title: string
  message: string | null
  path: string | null
  /** Chi tiết "cũ → mới"; rỗng nếu thao tác không có thay đổi dữ liệu cụ thể. */
  changes: ActivityChange[]
}

export interface ActivityPage {
  items: ActivityLog[]
  /** Còn dòng cũ hơn chưa tải. */
  hasMore: boolean
}
