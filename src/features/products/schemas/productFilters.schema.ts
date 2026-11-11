import { z } from 'zod'
import type { SortOrder } from '@/shared/types/sort'

export const PRODUCT_SORT_FIELDS = ['created_at', 'name', 'price', 'stock'] as const
export const PRODUCT_PAGE_SIZES = [10, 20, 50] as const

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number]
export type { SortOrder }

/**
 * Filter / sort / phân trang của danh sách sản phẩm, lưu trên URL.
 * Mỗi trường có `.catch()` nên URL thiếu hoặc bị sửa tay sai vẫn ra state hợp lệ.
 */
export const productFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  category: z.string().trim().max(100).catch(''),
  status: z.enum(['all', 'active', 'inactive']).catch('all'),
  stock: z.enum(['all', 'low', 'out']).catch('all'),
  sort: z.enum(PRODUCT_SORT_FIELDS).catch('created_at'),
  order: z.enum(['asc', 'desc']).catch('desc'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .refine((size) => (PRODUCT_PAGE_SIZES as readonly number[]).includes(size))
    .catch(PRODUCT_PAGE_SIZES[0]),
})

export type ProductFilters = z.infer<typeof productFiltersSchema>

/** Chiều sắp xếp mặc định khi chọn một cột mới: chữ A→Z, số / ngày lớn → nhỏ. */
export const DEFAULT_SORT_ORDER: Readonly<Record<ProductSortField, SortOrder>> = {
  created_at: 'desc',
  name: 'asc',
  price: 'desc',
  stock: 'asc',
}
