import { z } from 'zod'

/** Phạm vi biên bản kiểm kê trên URL (`/inventory/stocktake?status=all&category=Áo thun`). */
export const stocktakeScopeSchema = z.object({
  status: z.enum(['active', 'all']).catch('all'),
  category: z.string().trim().max(100).catch(''),
})

export type StocktakeScope = z.infer<typeof stocktakeScopeSchema>

export function describeStocktakeScope(scope: StocktakeScope): string {
  const status = scope.status === 'active' ? 'sản phẩm đang bán' : 'tất cả sản phẩm'
  return scope.category ? `${status}, danh mục "${scope.category}"` : status
}
