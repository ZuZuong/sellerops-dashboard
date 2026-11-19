import { z } from 'zod'
import { emailSchema, newPasswordSchema } from './password.schema'

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Vui lòng nhập họ tên (ít nhất 2 ký tự)')
      .max(200, 'Họ tên tối đa 200 ký tự'),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email: emailSchema })

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
