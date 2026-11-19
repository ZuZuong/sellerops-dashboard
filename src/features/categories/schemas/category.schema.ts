import { z } from 'zod'

/** Tên danh mục: gộp khoảng trắng thừa, 1–50 ký tự (khớp CHECK + RPC trong DB). */
export const categoryNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Vui lòng nhập tên danh mục').max(50, 'Tên danh mục tối đa 50 ký tự'))

/** Khóa so trùng tên — giống `normalize_product_name` trong DB (không phân biệt hoa thường). */
export const categoryNameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Lỗi validate tên danh mục (rỗng / quá dài / trùng tên trong shop); null nếu hợp lệ.
 * `ignoreId`: bỏ qua chính danh mục đang đổi tên.
 */
export function validateCategoryName(
  value: string,
  existing: readonly { id: string; name: string }[],
  ignoreId?: string,
): string | null {
  const parsed = categoryNameSchema.safeParse(value)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Tên không hợp lệ'
  const key = categoryNameKey(parsed.data)
  const duplicate = existing.some((c) => c.id !== ignoreId && categoryNameKey(c.name) === key)
  return duplicate ? 'Đã có danh mục cùng tên' : null
}
