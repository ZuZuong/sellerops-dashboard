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

/** Nghe thay đổi trên shop của chính mình (admin duyệt / từ chối / tạm khóa). Trả về hàm hủy. */
export function subscribeToOwnSeller(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`seller:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sellers', filter: `owner_id=eq.${userId}` },
      onChange,
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
