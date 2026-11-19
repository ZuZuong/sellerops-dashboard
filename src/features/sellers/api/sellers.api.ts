import { supabase } from '@/shared/lib/supabase'
import type { Seller } from '../types'

/** Shop của người đăng nhập (RLS: chủ shop chỉ đọc được dòng của mình). `null` nếu chưa có shop. */
export async function fetchOwnSeller(userId: string): Promise<Seller | null> {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
