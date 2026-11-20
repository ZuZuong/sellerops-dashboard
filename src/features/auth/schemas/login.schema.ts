import { z } from 'zod'
import { isDemoUsername } from '@/shared/lib/demo/demoSession'

const emailFormat = z.email()

/** Email, hoặc tên tài khoản demo (admintest / sellertest — xem ADR 011). */
const loginIdSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .max(254, 'Email quá dài')
  .refine((value) => isDemoUsername(value) || emailFormat.safeParse(value).success, {
    message: 'Email không hợp lệ',
  })
  .transform((value) => (isDemoUsername(value) ? value.toLowerCase() : value))

export const loginSchema = z.object({
  email: loginIdSchema,
  // Không áp chính sách độ mạnh mật khẩu ở form đăng nhập — đó là việc của form đăng ký.
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export type LoginInput = z.infer<typeof loginSchema>
