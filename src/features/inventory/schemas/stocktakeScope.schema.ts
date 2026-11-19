import { z } from 'zod'

/** Phạm vi biên bản kiểm kê trên URL (`/seller/inventory/stocktake?status=all&category=<id>`). */
export const stocktakeScopeSchema = z.object({
  status: z.enum(['active', 'all']).catch('all'),
  /** Id danh mục; rỗng = mọi danh mục. */
  category: z.union([z.uuid(), z.literal('')]).catch(''),
})

export type StocktakeScope = z.infer<typeof stocktakeScopeSchema>

/** `categoryName`: tên của danh mục đang lọc (tra từ danh sách danh mục của shop). */
export function describeStocktakeScope(scope: StocktakeScope, categoryName?: string): string {
  const status = scope.status === 'active' ? 'sản phẩm đang bán' : 'tất cả sản phẩm'
  return scope.category && categoryName ? `${status}, danh mục "${categoryName}"` : status
}
