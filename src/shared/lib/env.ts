import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .refine((key) => !key.startsWith('sb_secret_'), {
      message: 'Không được dùng secret key ở client — hãy dùng publishable key.',
    }),
  /** `true`: mọi tab dùng chung một phiên đăng nhập (mặc định: mỗi tab một phiên riêng). */
  VITE_AUTH_SHARED_SESSION: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  throw new Error(
    `Biến môi trường không hợp lệ (xem .env.example):\n${z.prettifyError(parsed.error)}`,
  )
}

export const env = parsed.data
