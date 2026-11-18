/**
 * Chi tiết "cũ → mới" đính kèm vào thông báo (toast) để nhật ký hoạt động ghi rõ đã đổi gì.
 *
 *   notifications.show({ color: 'green', title: 'Đã cập nhật giá', message: name,
 *     ...withChanges([change('Giá bán', formatCurrency(old), formatCurrency(next))]) })
 *
 * Giá trị luôn là chuỗi đã định dạng sẵn (tiền, ngày, nhãn trạng thái…) để nhật ký hiển thị
 * đúng như lúc thay đổi, không phụ thuộc dữ liệu hiện tại. `null` = không có (tạo mới / xóa).
 */

export interface ActivityChange {
  field: string
  from: string | null
  to: string | null
}

export const ACTIVITY_CHANGES_ATTR = 'data-activity-changes'

/** Số dòng thay đổi tối đa mỗi thông báo (giới hạn kích thước nhật ký). */
export const MAX_ACTIVITY_CHANGES = 30
const MAX_VALUE_LENGTH = 300

const clip = (value: string | null): string | null =>
  value === null
    ? null
    : value.length > MAX_VALUE_LENGTH
      ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…`
      : value

export function change(
  field: string,
  from: string | number | null | undefined,
  to: string | number | null | undefined,
): ActivityChange {
  const norm = (v: string | number | null | undefined) =>
    v === null || v === undefined || v === '' ? null : String(v)
  return { field, from: clip(norm(from)), to: clip(norm(to)) }
}

/** Thuộc tính gắn vào `notifications.show(...)`; bỏ các dòng không đổi giá trị. */
export function withChanges(changes: readonly ActivityChange[]): {
  [ACTIVITY_CHANGES_ATTR]: ActivityChange[]
} {
  return {
    [ACTIVITY_CHANGES_ATTR]: changes.filter((c) => c.from !== c.to).slice(0, MAX_ACTIVITY_CHANGES),
  }
}

const show = (value: string | null) => value ?? '(trống)'

/** Một dòng chữ "Giá bán: 150.000 ₫ → 199.000 ₫" — dùng làm nội dung thông báo. */
export function formatChange(c: ActivityChange): string {
  return `${c.field}: ${show(c.from)} → ${show(c.to)}`
}

/** Nhiều thay đổi → mỗi thay đổi một dòng. */
export function describeChanges(changes: readonly ActivityChange[]): string {
  return changes.map(formatChange).join('\n')
}

export interface DiffField<T> {
  field: string
  value: (row: T) => string | number | null | undefined
}

/** So sánh hai bản ghi theo danh sách trường → chỉ các trường thực sự đổi. */
export function diffRecords<T>(
  before: T,
  after: T,
  fields: readonly DiffField<T>[],
): ActivityChange[] {
  return fields
    .map(({ field, value }) => change(field, value(before), value(after)))
    .filter((c) => c.from !== c.to)
}

function isChange(value: unknown): value is ActivityChange {
  if (typeof value !== 'object' || value === null) return false
  const { field, from, to } = value as Record<string, unknown>
  const ok = (v: unknown) => v === null || typeof v === 'string'
  return typeof field === 'string' && field.length > 0 && ok(from) && ok(to)
}

/** Đọc lại danh sách thay đổi (từ toast hoặc từ DB) — dữ liệu sai dạng bị bỏ qua. */
export function parseActivityChanges(value: unknown): ActivityChange[] {
  return Array.isArray(value) ? value.filter(isChange).slice(0, MAX_ACTIVITY_CHANGES) : []
}
