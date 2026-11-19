import { z } from 'zod'

/**
 * Bộ lọc các trang admin, lưu trên URL. Mỗi trường có `.catch()` nên URL thiếu / sửa tay sai vẫn
 * ra state hợp lệ (yêu cầu của `useUrlState`).
 */

export const ADMIN_PAGE_SIZES = [20, 50, 100] as const

const page = z.coerce.number().int().min(1).catch(1)
const pageSize = z.coerce
  .number()
  .refine((size) => (ADMIN_PAGE_SIZES as readonly number[]).includes(size))
  .catch(ADMIN_PAGE_SIZES[0])
const q = z.string().trim().max(100).catch('')

export const accountFiltersSchema = z.object({
  q,
  role: z.enum(['all', 'admin', 'seller', 'customer']).catch('all'),
  /** Trạng thái: hoạt động / bị khóa / chờ xóa / đã xóa. */
  state: z.enum(['all', 'active', 'locked', 'pending_deletion']).catch('all'),
  page,
  pageSize,
})
export type AccountFilters = z.infer<typeof accountFiltersSchema>

export const sellerFiltersSchema = z.object({
  q,
  status: z.enum(['all', 'draft', 'pending', 'approved', 'rejected', 'suspended']).catch('all'),
  page,
  pageSize,
})
export type SellerFilters = z.infer<typeof sellerFiltersSchema>

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(''))
  .catch('')

export const auditFiltersSchema = z.object({
  actor: z.union([z.uuid(), z.literal('')]).catch(''),
  action: z
    .string()
    .regex(/^[a-z_]+\.[a-z_]+$/)
    .or(z.literal(''))
    .catch(''),
  from: isoDate,
  to: isoDate,
  page,
  pageSize,
})
export type AuditFilters = z.infer<typeof auditFiltersSchema>

export const deletionFiltersSchema = z.object({
  q,
  status: z.enum(['pending', 'confirmed', 'restored', 'all']).catch('pending'),
  page,
  pageSize,
})
export type DeletionFilters = z.infer<typeof deletionFiltersSchema>

/** Tab của trang chi tiết shop (`?tab=`). */
export const SELLER_DETAIL_TABS = [
  'profile',
  'products',
  'categories',
  'orders',
  'inventory',
  'analytics',
  'activity',
] as const
export type SellerDetailTab = (typeof SELLER_DETAIL_TABS)[number]
export const sellerDetailTabSchema = z.object({ tab: z.enum(SELLER_DETAIL_TABS).catch('profile') })
