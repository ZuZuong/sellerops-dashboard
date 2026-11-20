import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_ACCOUNTS, endDemoSession, startDemoSession } from '@/shared/lib/demo/demoSession'
import { DEMO_NETWORK_BLOCKED, guardedFetch } from '@/shared/lib/supabase'

/*
 * Tài khoản dùng thử KHÔNG BAO GIỜ được chạm tới dữ liệu thật (ADR 011). Hai lớp bảo vệ:
 *  1. Mọi hàm `api/*.api.ts` chuyển sang backend giả lập khi `isDemoMode()`.
 *  2. Supabase client chặn mọi request khi `isDemoMode()` (hàng rào cuối nếu lớp 1 sót).
 */

afterEach(() => {
  endDemoSession()
})

describe('hàng rào mạng của Supabase client', () => {
  it('chế độ dùng thử: chặn request trước khi rời trình duyệt', async () => {
    const realFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    const [account] = DEMO_ACCOUNTS
    if (account) startDemoSession(account)

    await expect(guardedFetch('http://localhost:54321/rest/v1/sellers')).rejects.toThrow(
      DEMO_NETWORK_BLOCKED,
    )
    expect(realFetch).not.toHaveBeenCalled()
  })

  it('tài khoản thật: request đi bình thường', async () => {
    const realFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
    await guardedFetch('http://localhost:54321/rest/v1/sellers')
    expect(realFetch).toHaveBeenCalledTimes(1)
  })
})

/** Hàm không cần dòng `isDemoMode()` riêng — kèm lý do. Hàng rào mạng vẫn chặn nếu lỡ gọi. */
const NO_DEMO_BRANCH = new Map([
  ['auth.api.ts:signUp', 'chỉ dùng khi chưa đăng nhập'],
  ['auth.api.ts:resendVerificationEmail', 'chỉ dùng khi chưa đăng nhập'],
  ['auth.api.ts:requestPasswordReset', 'chỉ dùng khi chưa đăng nhập'],
  ['auth.api.ts:updatePassword', 'chỉ dùng với phiên khôi phục mật khẩu thật'],
  ['auth.api.ts:signIn', 'rẽ sang demo bằng findDemoAccount()'],
  ['productImages.api.ts:uploadProductMedia', 'gọi uploadImage(), hàm này đã rẽ sang demo'],
])

const apiSources = import.meta.glob<string>('/src/features/*/api/*.api.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('mọi hàm API có nhánh dùng thử', () => {
  it('tìm thấy các file api', () => {
    expect(Object.keys(apiSources).length).toBeGreaterThanOrEqual(14)
  })

  it.each(Object.entries(apiSources))('%s', (path, source) => {
    const file = path.split('/').pop() ?? path
    const missing: string[] = []
    const fnPattern = /export (async )?function (\w+)\([\s\S]*?\)(?::[^{]*)?\{\n([\s\S]*?)\n\}/g
    for (const match of source.matchAll(fnPattern)) {
      const [, isAsync, name = '', body = ''] = match
      // Hàm đồng bộ thuần (ghép URL, chuyển kiểu…) phải tự kiểm tra nếu có gọi Supabase.
      const touchesBackend = /supabase\.|await /.test(body)
      if (!touchesBackend || NO_DEMO_BRANCH.has(`${file}:${name}`)) continue
      if (!/isDemoMode\(\)/.test(body)) missing.push(`${name}${isAsync ? '' : ' (sync)'}`)
    }
    expect(missing).toEqual([])
  })
})
