import { z } from 'zod'

/** Supabase Auth băm mật khẩu bằng bcrypt: chỉ 72 byte đầu có hiệu lực. */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .max(254, 'Email quá dài')
  .pipe(z.email('Email không hợp lệ'))

export const newPasswordSchema = z
  .string()
  .min(1, 'Vui lòng nhập mật khẩu')
  .min(PASSWORD_MIN, `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự`)
  .max(PASSWORD_MAX, `Mật khẩu tối đa ${PASSWORD_MAX} ký tự`)

/** Mật khẩu mới + nhập lại (dùng cho đăng ký và đặt lại mật khẩu). */
export const passwordPairSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })

export type PasswordPairInput = z.infer<typeof passwordPairSchema>
