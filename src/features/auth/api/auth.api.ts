import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import type { LoginInput } from '../schemas/login.schema'

export async function signIn({ email, password }: LoginInput): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Đăng ký lắng nghe thay đổi phiên; trả về hàm hủy đăng ký. */
export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}
