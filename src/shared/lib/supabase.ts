import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database.types'
import { env } from './env'

/**
 * Supabase client dùng chung cho toàn app.
 * Chỉ được import trong `features/<name>/api/` — component không gọi Supabase trực tiếp.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
