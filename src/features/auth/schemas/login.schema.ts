import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email').pipe(z.email('Email không hợp lệ')),
  // Không áp chính sách độ mạnh mật khẩu ở form đăng nhập — đó là việc của form đăng ký.
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

export type LoginInput = z.infer<typeof loginSchema>
