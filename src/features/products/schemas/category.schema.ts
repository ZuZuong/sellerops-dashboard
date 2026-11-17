import { z } from 'zod'

/** Tên danh mục: gộp khoảng trắng thừa, 1–50 ký tự (khớp CHECK + RPC trong DB). */
export const categoryNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Vui lòng nhập tên danh mục').max(50, 'Tên danh mục tối đa 50 ký tự'))
