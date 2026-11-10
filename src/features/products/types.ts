import type { Tables } from '@/shared/types/database.types'

export type Product = Pick<
  Tables<'products'>,
  | 'id'
  | 'sku'
  | 'name'
  | 'category'
  | 'price'
  | 'stock'
  | 'low_stock_threshold'
  | 'is_low_stock'
  | 'is_active'
  | 'created_at'
>

export interface ProductPage {
  items: Product[]
  total: number
}
