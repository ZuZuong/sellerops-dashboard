import { z } from 'zod'

export const INVENTORY_SORT_FIELDS = ['stock', 'name', 'cost_price'] as const
export const INVENTORY_PAGE_SIZES = [10, 20, 50] as const

export type InventorySortField = (typeof INVENTORY_SORT_FIELDS)[number]

/**
 * Filter / sort / phân trang trang Kho hàng, lưu trên URL.
 * Mặc định: sản phẩm đang bán, tồn kho thấp nhất lên đầu (việc cần xử lý trước).
 */
export const inventoryFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  /** low = còn hàng nhưng ≤ ngưỡng cảnh báo; out = hết hàng; ok = trên ngưỡng. */
  level: z.enum(['all', 'low', 'out', 'ok']).catch('all'),
  status: z.enum(['active', 'all']).catch('active'),
  sort: z.enum(INVENTORY_SORT_FIELDS).catch('stock'),
  order: z.enum(['asc', 'desc']).catch('asc'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .refine((size) => (INVENTORY_PAGE_SIZES as readonly number[]).includes(size))
    .catch(INVENTORY_PAGE_SIZES[0]),
})

export type InventoryFilters = z.infer<typeof inventoryFiltersSchema>
export type StockLevelFilter = InventoryFilters['level']
