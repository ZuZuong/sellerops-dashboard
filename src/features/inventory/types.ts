import type { Database, Tables } from '@/shared/types/database.types'

/** Dòng tồn kho; `category` là tên danh mục đã làm phẳng (null = chưa có danh mục). */
export type InventoryItem = Pick<
  Tables<'products'>,
  | 'id'
  | 'sku'
  | 'name'
  | 'price'
  | 'cost_price'
  | 'unit'
  | 'stock'
  | 'low_stock_threshold'
  | 'is_low_stock'
  | 'is_active'
> & { category: string | null }

export interface InventoryPage {
  items: InventoryItem[]
  total: number
}

export type InventorySummary =
  Database['public']['Functions']['get_inventory_summary']['Returns'][number]

export interface StockMovement extends Pick<
  Tables<'inventory_movements'>,
  'id' | 'delta' | 'reason' | 'note' | 'created_at' | 'unit_cost'
> {
  order: Pick<Tables<'orders'>, 'id' | 'code'> | null
  receipt: Pick<Tables<'purchase_receipts'>, 'id' | 'code'> | null
}

export interface MovementPage {
  items: StockMovement[]
  total: number
}
