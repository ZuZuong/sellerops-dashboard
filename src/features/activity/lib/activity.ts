import type { ReactNode } from 'react'
import { ROUTES } from '@/shared/constants/routes'
import { ACTIVITY_CHANGES_ATTR, parseActivityChanges } from '@/shared/lib/activityChanges'
import { ACTIVITY_LEVELS, type ActivityInput, type ActivityLevel } from '../types'

/**
 * Chuyển thông báo (toast) của app thành một dòng nhật ký. Toast nào có `data-activity-skip` thì
 * không ghi (vd. chính thông báo "đã xóa lịch sử thông báo").
 */

export const ACTIVITY_SKIP_ATTR = 'data-activity-skip'

const MAX_TITLE = 200
const MAX_MESSAGE = 1000
const MAX_PATH = 300

export function isActivityLevel(value: unknown): value is ActivityLevel {
  return typeof value === 'string' && (ACTIVITY_LEVELS as readonly string[]).includes(value)
}

/** Màu Mantine của toast → mức độ nhật ký. */
export function levelFromColor(color: string | undefined): ActivityLevel {
  switch (color) {
    case 'green':
    case 'teal':
      return 'success'
    case 'red':
      return 'error'
    case 'orange':
    case 'yellow':
      return 'warning'
    default:
      return 'info'
  }
}

/** Lấy chữ từ nội dung toast; nội dung JSX phức tạp (không phải chữ) → null. */
export function toPlainText(node: ReactNode): string | null {
  return rawText(node)?.trim() || null
}

/** Ghép chữ giữ nguyên khoảng trắng giữa các phần (`['Còn ', 5, ' sản phẩm']`). */
function rawText(node: ReactNode): string | null {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    const parts = node.map(rawText)
    return parts.some((part) => part === null) ? null : parts.join('')
  }
  return null
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

export interface NotificationLike {
  title?: ReactNode
  message: ReactNode
  color?: string
  [key: `data-${string}`]: unknown
}

export function toActivityInput(
  notification: NotificationLike,
  path: string | null,
): ActivityInput | null {
  if (notification[ACTIVITY_SKIP_ATTR]) return null
  const title = toPlainText(notification.title)
  const message = toPlainText(notification.message)
  // Toast chỉ có nội dung (không tiêu đề) → nội dung thành tiêu đề.
  const heading = title ?? message
  if (!heading) return null
  return {
    level: levelFromColor(notification.color),
    title: clip(heading, MAX_TITLE),
    message: title && message ? clip(message, MAX_MESSAGE) : null,
    path: path ? clip(path, MAX_PATH) : null,
    changes: parseActivityChanges(notification[ACTIVITY_CHANGES_ATTR]),
  }
}

/** Tên trang theo đường dẫn lúc thông báo xuất hiện (khớp tiền tố dài nhất). */
const PAGE_LABELS: ReadonlyArray<readonly [string, string]> = [
  [ROUTES.inventoryStocktake, 'Biên bản kiểm kê'],
  [ROUTES.analyticsRevenueReport, 'Bảng kê doanh thu'],
  [ROUTES.productImports, 'Lịch sử nhập Excel'],
  [ROUTES.productTrash, 'Thùng rác sản phẩm'],
  [ROUTES.productCategories, 'Danh mục sản phẩm'],
  [ROUTES.products, 'Sản phẩm'],
  [ROUTES.orders, 'Đơn hàng'],
  [ROUTES.purchases, 'Nhập hàng'],
  [ROUTES.inventory, 'Kho hàng'],
  [ROUTES.analytics, 'Phân tích'],
]

export function describePath(path: string | null): string | null {
  if (!path) return null
  if (path === ROUTES.dashboard) return 'Tổng quan'
  const match = PAGE_LABELS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return match ? match[1] : null
}

/** Số trên chuông: quá 99 hiện "99+". */
export function formatUnreadCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}
