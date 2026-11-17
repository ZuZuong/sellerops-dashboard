import { z } from 'zod'
import { supabase } from '@/shared/lib/supabase'
import type { ProductCategoryOverview } from '../types'

const deleteResultSchema = z.object({ products: z.number(), unpublished: z.number() })
export type DeleteCategoryResult = z.infer<typeof deleteResultSchema>

/** Danh mục của cửa hàng (A → Z theo tiếng Việt) kèm số sản phẩm đang dùng / đang bán. */
export async function fetchProductCategories(): Promise<ProductCategoryOverview[]> {
  const { data, error } = await supabase.rpc('get_product_category_overview')
  if (error) throw error
  return data
}

export async function createProductCategory(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_product_category', { p_name: name })
  if (error) throw error
  return data
}

/** Đổi tên → sản phẩm đang dùng danh mục (kể cả trong thùng rác) đổi theo. */
export async function renameProductCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_product_category', { p_id: id, p_name: name })
  if (error) throw error
}

/**
 * Xóa danh mục → sản phẩm đang dùng bị gắn cờ "danh mục đã bị xóa" và chuyển về lưu chưa đăng
 * cho tới khi seller chọn lại danh mục.
 */
export async function deleteProductCategory(id: string): Promise<DeleteCategoryResult> {
  const { data, error } = await supabase.rpc('delete_product_category', { p_id: id })
  if (error) throw error
  return deleteResultSchema.parse(data)
}
