import { z } from 'zod'
import type { SortOrder } from '@/shared/types/sort'

export const PRODUCT_SORT_FIELDS = ['created_at', 'name', 'price', 'cost_price', 'stock'] as const
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
  status: z.enum(['all', 'active', 'inactive', 'needs_category']).catch('all'),
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
  cost_price: 'desc',
  stock: 'asc',
}

/** Các cách sắp xếp trong ô "Sắp xếp" (giá trị `field:order`). */
export const PRODUCT_SORT_OPTIONS: ReadonlyArray<{
  value: `${ProductSortField}:${SortOrder}`
  label: string
}> = [
  { value: 'created_at:desc', label: 'Mới nhất' },
  { value: 'created_at:asc', label: 'Cũ nhất' },
  { value: 'name:asc', label: 'Tên A → Z' },
  { value: 'name:desc', label: 'Tên Z → A' },
  { value: 'price:desc', label: 'Giá bán cao → thấp' },
  { value: 'price:asc', label: 'Giá bán thấp → cao' },
  { value: 'cost_price:desc', label: 'Giá vốn cao → thấp' },
  { value: 'cost_price:asc', label: 'Giá vốn thấp → cao' },
  { value: 'stock:asc', label: 'Tồn kho thấp → cao' },
  { value: 'stock:desc', label: 'Tồn kho cao → thấp' },
]

/** "price:asc" → { sort: 'price', order: 'asc' }; giá trị lạ → null. */
export function parseSortOption(
  value: string | null,
): { sort: ProductSortField; order: SortOrder } | null {
  const option = PRODUCT_SORT_OPTIONS.find((o) => o.value === value)
  if (!option) return null
  const [sort, order] = option.value.split(':') as [ProductSortField, SortOrder]
  return { sort, order }
}
