import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { parseActivityChanges } from '@/shared/lib/activityChanges'
import { supabase } from '@/shared/lib/supabase'
import { isActivityLevel } from '../lib/activity'
import type { Json } from '@/shared/types/database.types'
import type { ActivityInput, ActivityLog, ActivityPage } from '../types'

const demo = () => import('./activity.demo')

const COLUMNS = 'id, level, title, message, path, changes, created_at, read_at'

/** `limit` dòng mới nhất (lấy dư một dòng để biết còn dòng cũ hơn không). */
export async function fetchActivityLogs(limit: number): Promise<ActivityPage> {
  if (isDemoMode()) return (await demo()).fetchActivityLogs(limit)
  const { data, error } = await supabase
    .from('activity_logs')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)
  if (error) throw error
  const items: ActivityLog[] = data.slice(0, limit).map((row) => ({
    ...row,
    level: isActivityLevel(row.level) ? row.level : 'info',
    changes: parseActivityChanges(row.changes),
  }))
  return { items, hasMore: data.length > limit }
}

export async function fetchUnreadActivityCount(): Promise<number> {
  if (isDemoMode()) return (await demo()).fetchUnreadActivityCount()
  const { count, error } = await supabase
    .from('activity_logs')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function insertActivityLog(input: ActivityInput): Promise<void> {
  if (isDemoMode()) return (await demo()).insertActivityLog(input)
  // ActivityChange[] là JSON hợp lệ; ép kiểu vì type sinh ra dùng `Json` chung.
  const { error } = await supabase
    .from('activity_logs')
    .insert({ ...input, changes: input.changes as unknown as Json })
  if (error) throw error
}

export async function markAllActivityRead(): Promise<void> {
  if (isDemoMode()) return (await demo()).markAllActivityRead()
  const { error } = await supabase
    .from('activity_logs')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

/** Xóa toàn bộ nhật ký của tài khoản (RLS giới hạn đúng dòng của người gọi). */
export async function clearActivityLogs(): Promise<void> {
  if (isDemoMode()) return (await demo()).clearActivityLogs()
  const { error } = await supabase.from('activity_logs').delete().not('id', 'is', null)
  if (error) throw error
}
