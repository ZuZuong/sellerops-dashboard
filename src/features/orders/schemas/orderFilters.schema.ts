import { z } from 'zod'
import { ORDER_STATUSES } from '../domain/orderStatus'

export const ORDER_SORT_FIELDS = ['created_at', 'total'] as const
export const ORDER_PAGE_SIZES = [10, 20, 50] as const

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number]

/**
 * Filter / sort / phân trang danh sách đơn hàng, lưu trên URL.
 * Mỗi trường có `.catch()` nên URL thiếu hoặc bị sửa tay sai vẫn ra state hợp lệ.
 */
export const orderFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  status: z.enum(['all', ...ORDER_STATUSES]).catch('all'),
  sort: z.enum(ORDER_SORT_FIELDS).catch('created_at'),
  order: z.enum(['asc', 'desc']).catch('desc'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .refine((size) => (ORDER_PAGE_SIZES as readonly number[]).includes(size))
    .catch(ORDER_PAGE_SIZES[0]),
})

export type OrderFilters = z.infer<typeof orderFiltersSchema>
export type OrderStatusFilter = OrderFilters['status']
