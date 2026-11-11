import type { Database, Tables } from '@/shared/types/database.types'

export type Product = Pick<
  Tables<'products'>,
  | 'id'
  | 'sku'
  | 'name'
  | 'category'
  | 'price'
  | 'cost_price'
  | 'unit'
  | 'stock'
  | 'low_stock_threshold'
  | 'is_low_stock'
  | 'is_active'
  | 'description'
  | 'hero_image_path'
  | 'image_paths'
  | 'created_at'
>

export interface ProductPage {
  items: Product[]
  total: number
}

export type ProductImport = Pick<
  Tables<'product_imports'>,
  | 'id'
  | 'file_name'
  | 'file_path'
  | 'file_size'
  | 'sheet_name'
  | 'row_count'
  | 'imported_count'
  | 'published'
  | 'created_at'
>

export interface ProductImportPage {
  items: ProductImport[]
  total: number
}

export type ImportedProductRow = Pick<
  Tables<'products'>,
  'id' | 'sku' | 'name' | 'category' | 'unit' | 'cost_price' | 'price' | 'stock' | 'is_active'
>

export type ProductInsight =
  Database['public']['Functions']['get_product_insight']['Returns'][number]
