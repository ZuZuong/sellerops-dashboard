import { z } from 'zod'
import { supabase } from '@/shared/lib/supabase'
import type { CategoryOverview } from '../types'

const deleteResultSchema = z.object({ moved: z.number() })
export type DeleteCategoryResult = z.infer<typeof deleteResultSchema>

/**
 * Danh mục của một shop (theo thứ tự seller sắp xếp) kèm số sản phẩm.
 * Seller xem được danh mục của mình ở mọi trạng thái (bước 3 hồ sơ); admin xem mọi shop.
 */
export async function fetchCategories(sellerId: string): Promise<CategoryOverview[]> {
  const { data, error } = await supabase.rpc('get_category_overview', { p_seller_id: sellerId })
  if (error) throw error
  return data
}

export async function createCategory(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_category', { p_name: name })
  if (error) throw error
  return data
}

/** Đổi tên / bật tắt. Sản phẩm trỏ theo id nên tự hiển thị tên mới. */
export async function updateCategory(id: string, name: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_category', {
    p_id: id,
    p_name: name,
    p_is_active: isActive,
  })
  if (error) throw error
}

/** Lưu thứ tự mới theo đúng thứ tự mảng id. */
export async function reorderCategories(ids: readonly string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_categories', { p_ids: [...ids] })
  if (error) throw error
}

/**
 * Xóa danh mục. Đang có sản phẩm thì bắt buộc chỉ định danh mục khác cùng shop để chuyển sang
 * (RPC raise CATEGORY_IN_USE nếu thiếu).
 */
export async function deleteCategory(
  id: string,
  moveToId: string | null,
): Promise<DeleteCategoryResult> {
  const { data, error } = await supabase.rpc('delete_category', {
    p_id: id,
    p_move_to_id: moveToId ?? undefined,
  })
  if (error) throw error
  return deleteResultSchema.parse(data)
}
