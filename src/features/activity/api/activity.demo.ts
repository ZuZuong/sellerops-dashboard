import { newId, nowIso, readDemoDb, writeDemoDb } from '@/shared/lib/demo/demoDb'
import { getDemoUserId } from '@/shared/lib/demo/demoSession'
import { parseActivityChanges } from '@/shared/lib/activityChanges'
import type { Json } from '@/shared/types/database.types'
import { isActivityLevel } from '../lib/activity'
import type { ActivityInput, ActivityLog, ActivityPage } from '../types'

/* Backend giả lập (chế độ demo — ADR 011): nhật ký hoạt động của chính người đăng nhập. */

const own = <T extends { user_id: string }>(rows: T[]) =>
  rows.filter((r) => r.user_id === getDemoUserId())

export async function fetchActivityLogs(limit: number): Promise<ActivityPage> {
  const db = await readDemoDb()
  const rows = own(db.activity_logs).sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )
  const items: ActivityLog[] = rows.slice(0, limit).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    path: row.path,
    created_at: row.created_at,
    read_at: row.read_at,
    level: isActivityLevel(row.level) ? row.level : 'info',
    changes: parseActivityChanges(row.changes),
  }))
  return { items, hasMore: rows.length > limit }
}

export async function fetchUnreadActivityCount(): Promise<number> {
  const db = await readDemoDb()
  return own(db.activity_logs).filter((r) => r.read_at === null).length
}

export async function insertActivityLog(input: ActivityInput): Promise<void> {
  const userId = getDemoUserId()
  if (!userId) return
  await writeDemoDb((db) => {
    db.activity_logs.push({
      id: newId(),
      user_id: userId,
      ...input,
      changes: input.changes as unknown as Json,
      created_at: nowIso(),
      read_at: null,
    })
  })
}

export async function markAllActivityRead(): Promise<void> {
  await writeDemoDb((db) => {
    const now = nowIso()
    own(db.activity_logs).forEach((r) => {
      if (r.read_at === null) r.read_at = now
    })
  })
}

export async function clearActivityLogs(): Promise<void> {
  await writeDemoDb((db) => {
    const userId = getDemoUserId()
    db.activity_logs = db.activity_logs.filter((r) => r.user_id !== userId)
  })
}
