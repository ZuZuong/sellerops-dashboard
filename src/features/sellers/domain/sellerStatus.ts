/**
 * State machine trạng thái shop — NGUỒN DUY NHẤT phía client.
 *
 *   draft ──► pending ──► approved ◄──► suspended
 *                │
 *                └──► rejected ──► pending (sửa và gửi lại)
 *
 * Database kiểm tra lại đúng quy tắc này trong `seller_status_can_transition` (trigger trên bảng
 * sellers); test `sellerStatus.test.ts` đọc migration để bảo đảm hai nơi không lệch nhau.
 * Ở client, state machine dùng để chọn modal khóa dashboard và ẩn thao tác admin không hợp lệ.
 */

export const SELLER_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'suspended'] as const

export type SellerStatus = (typeof SELLER_STATUSES)[number]

export const SELLER_TRANSITIONS: Readonly<Record<SellerStatus, readonly SellerStatus[]>> = {
  draft: ['pending'],
  pending: ['approved', 'rejected'],
  approved: ['suspended'],
  rejected: ['pending'],
  suspended: ['approved'],
}

export const SELLER_STATUS_META: Readonly<
  Record<SellerStatus, { label: string; color: string; description: string }>
> = {
  draft: {
    label: 'Đang hoàn tất hồ sơ',
    color: 'gray',
    description: 'Shop chưa gửi hồ sơ kinh doanh.',
  },
  pending: {
    label: 'Chờ duyệt',
    color: 'yellow',
    description: 'Hồ sơ đã gửi, đang chờ quản trị viên xét duyệt.',
  },
  approved: {
    label: 'Đã duyệt',
    color: 'green',
    description: 'Shop đang hoạt động.',
  },
  rejected: {
    label: 'Bị từ chối',
    color: 'red',
    description: 'Hồ sơ bị từ chối, cần sửa và gửi lại.',
  },
  suspended: {
    label: 'Tạm khóa',
    color: 'orange',
    description: 'Shop bị quản trị viên tạm khóa.',
  },
}

export function canTransitionSeller(from: SellerStatus, to: SellerStatus): boolean {
  return SELLER_TRANSITIONS[from].includes(to)
}

/** Chỉ shop `approved` được dùng dashboard; các trạng thái còn lại bị khóa bằng modal. */
export function isSellerActive(status: SellerStatus): boolean {
  return status === 'approved'
}

/** Seller sửa được hồ sơ (lưu nháp, tải giấy tờ, gửi lại) khi nào. */
export function isApplicationEditable(status: SellerStatus): boolean {
  return status === 'draft' || status === 'rejected'
}

export function isSellerStatus(value: unknown): value is SellerStatus {
  return typeof value === 'string' && (SELLER_STATUSES as readonly string[]).includes(value)
}
