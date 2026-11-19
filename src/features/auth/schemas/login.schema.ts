import { z } from 'zod'
import { emailSchema } from './password.schema'

export const loginSchema = z.object({
  email: emailSchema,
  // Không áp chính sách độ mạnh mật khẩu ở form đăng nhập — đó là việc của form đăng ký.
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export type LoginInput = z.infer<typeof loginSchema>
