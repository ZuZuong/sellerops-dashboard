import { isDemoMode } from '@/shared/lib/demo/demoSession'
import { z } from 'zod'
import { supabase } from '@/shared/lib/supabase'
import type { TrashedProduct, TrashedProductPage } from '../types'
import { removeProductImages } from './productImages.api'

const demo = () => import('./products.demo')

const trashResultSchema = z.object({ trashed: z.number(), deactivated: z.number() })
const restoreResultSchema = z.object({ restored: z.number(), skipped: z.array(z.string()) })

export type TrashResult = z.infer<typeof trashResultSchema>
export type RestoreResult = z.infer<typeof restoreResultSchema>

/**
 * Xóa sản phẩm → chuyển vào thùng rác (khôi phục được trong 30 ngày).
 * Sản phẩm đã có trong đơn hàng / phiếu nhập không xóa được, DB chỉ chuyển sang ngừng bán.
 */
export async function trashProducts(ids: readonly string[]): Promise<TrashResult> {
  if (isDemoMode()) return (await demo()).trashProducts(ids)
  const { data, error } = await supabase.rpc('trash_products', { p_ids: [...ids] })
  if (error) throw error
  return trashResultSchema.parse(data)
}

/** Khôi phục; sản phẩm trùng tên với sản phẩm đang có thì bị bỏ qua (`skipped`). */
export async function restoreProducts(ids: readonly string[]): Promise<RestoreResult> {
  if (isDemoMode()) return (await demo()).restoreProducts(ids)
  const { data, error } = await supabase.rpc('restore_products', { p_ids: [...ids] })
  if (error) throw error
  return restoreResultSchema.parse(data)
}

/** Xóa vĩnh viễn ngay (không chờ 30 ngày), dọn luôn ảnh trong Storage. */
export async function purgeTrash(ids: readonly string[]): Promise<number> {
  if (isDemoMode()) return (await demo()).purgeTrash(ids)
  const { data, error } = await supabase.rpc('purge_trash', { p_ids: [...ids] })
  if (error) throw error
  await removeProductImages(data)
  return ids.length
}

/** Khoảng cách tối thiểu giữa hai lần dọn thùng rác (RPC có ghi DB + xóa file Storage). */
const PURGE_INTERVAL_MS = 10 * 60_000
let lastPurgeAt = 0

/**
 * Dọn sản phẩm quá hạn 30 ngày, tối đa mỗi 10 phút một lần (không gọi lại mỗi lần mở trang).
 * Lỗi dọn không chặn việc xem thùng rác.
 */
async function purgeExpiredTrash(): Promise<void> {
  if (Date.now() - lastPurgeAt < PURGE_INTERVAL_MS) return
  lastPurgeAt = Date.now()
  const { data, error } = await supabase.rpc('purge_expired_trash')
  if (error) {
    lastPurgeAt = 0
    return
  }
  await removeProductImages(data).catch(() => undefined)
}

const TRASH_COLUMNS =
  'id, sku, name, category, unit, price, cost_price, stock, hero_image_path, deleted_at, purge_at'

/** Thùng rác, mới xóa trước, phân trang phía server. Dọn mục quá hạn trước khi đọc. */
export async function fetchProductTrash(
  sellerId: string,
  page: number,
  pageSize: number,
): Promise<TrashedProductPage> {
  if (isDemoMode()) return (await demo()).fetchProductTrash(sellerId, page, pageSize)
  await purgeExpiredTrash()
  const from = (page - 1) * pageSize
  const { data, error, count } = await supabase
    .from('product_trash')
    .select(TRASH_COLUMNS, { count: 'exact' })
    .eq('seller_id', sellerId)
    .order('deleted_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { items: data satisfies TrashedProduct[], total: count ?? data.length }
}

/** Số sản phẩm trong thùng rác (cho nút trên trang Sản phẩm). */
export async function countProductTrash(sellerId: string): Promise<number> {
  if (isDemoMode()) return (await demo()).countProductTrash(sellerId)
  await purgeExpiredTrash()
  const { count, error } = await supabase
    .from('product_trash')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
  if (error) throw error
  return count ?? 0
}

/** Tên nào trong danh sách đã có sản phẩm (không phân biệt hoa thường / khoảng trắng thừa). */
export async function findExistingProductNames(names: readonly string[]): Promise<Set<string>> {
  if (isDemoMode()) return (await demo()).findExistingProductNames(names)
  if (names.length === 0) return new Set()
  const { data, error } = await supabase.rpc('find_existing_product_names', {
    p_names: [...names],
  })
  if (error) throw error
  return new Set(data)
}
