const DAY_MS = 24 * 60 * 60 * 1000

/** Số ngày còn lại trước khi bị xóa vĩnh viễn (làm tròn lên, tối thiểu 0). */
export function daysUntilPurge(purgeAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now) / DAY_MS))
}
