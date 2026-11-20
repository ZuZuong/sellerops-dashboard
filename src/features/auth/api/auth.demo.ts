import type { Session, User } from '@supabase/supabase-js'
import { readDemoDb, writeDemoDb } from '@/shared/lib/demo/demoDb'
import { startDemoSession, type DemoAccount } from '@/shared/lib/demo/demoSession'
import type { Account } from '../domain/account'

/**
 * Đăng nhập tài khoản demo. Sai mật khẩu, hoặc tài khoản đã bị admin xóa vĩnh viễn trong dữ liệu
 * demo của tab → `null` (UI báo sai thông tin đăng nhập như Supabase).
 */
export async function signInDemo(account: DemoAccount, password: string): Promise<Session | null> {
  if (password !== account.password) return null
  const exists = await writeDemoDb((db) => {
    const user = db.users.find((u) => u.id === account.userId)
    if (user) user.last_sign_in_at = new Date().toISOString()
    return Boolean(user)
  })
  return exists ? startDemoSession(account) : null
}

export async function fetchAccount(user: User): Promise<Account> {
  const db = await readDemoDb()
  const profile = db.profiles.find((p) => p.id === user.id)
  return {
    id: user.id,
    email: user.email ?? '',
    role: profile?.role ?? 'customer',
    fullName: profile?.full_name ?? null,
    status: profile?.account_status ?? 'deleted',
    isLocked: profile?.is_locked ?? true,
    lockedReason: profile?.locked_reason ?? null,
  }
}
