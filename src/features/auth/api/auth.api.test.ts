import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const profileResult = vi.fn()
const rpc = vi.fn()

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: profileResult }) }),
    }),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

const { fetchAccount, needsSellerRegistration } = await import('./auth.api')

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'shop@example.com',
    email_confirmed_at: '2026-11-19T00:00:00Z',
    user_metadata: { signup_intent: 'seller' },
    ...overrides,
  }) as User

const profile = (role: string, isLocked = false) => ({
  data: { id: 'user-1', role, full_name: 'A', is_locked: isLocked, locked_reason: null },
  error: null,
})

beforeEach(() => {
  profileResult.mockReset()
  rpc.mockReset().mockResolvedValue({ data: 'seller-1', error: null })
})

describe('needsSellerRegistration', () => {
  it('chỉ khi: đăng ký từ trang seller + đã xác minh email + chưa có role seller/admin', () => {
    expect(needsSellerRegistration(user(), 'customer')).toBe(true)
    expect(needsSellerRegistration(user(), null)).toBe(true)
    expect(needsSellerRegistration(user(), 'seller')).toBe(false)
    expect(needsSellerRegistration(user(), 'admin')).toBe(false)
    expect(needsSellerRegistration(user({ email_confirmed_at: undefined }), 'customer')).toBe(false)
    expect(needsSellerRegistration(user({ user_metadata: {} }), 'customer')).toBe(false)
  })
})

describe('fetchAccount', () => {
  it('role đọc từ profiles (không từ metadata)', async () => {
    profileResult.mockResolvedValue(profile('admin'))
    const account = await fetchAccount(user({ user_metadata: { role: 'seller' } }))
    expect(account.role).toBe('admin')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('vừa xác minh email sau khi đăng ký seller → gọi register_as_seller rồi đọc lại', async () => {
    profileResult
      .mockResolvedValueOnce(profile('customer'))
      .mockResolvedValueOnce(profile('seller'))
    const account = await fetchAccount(user({ id: 'user-new-1' }))
    expect(rpc).toHaveBeenCalledWith('register_as_seller')
    expect(account.role).toBe('seller')
  })

  it('gọi đồng thời nhiều lần → register_as_seller chỉ chạy một lần', async () => {
    profileResult.mockResolvedValue(profile('customer'))
    await Promise.all([
      fetchAccount(user({ id: 'user-new-2' })),
      fetchAccount(user({ id: 'user-new-2' })),
    ])
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('tài khoản bị khóa không tự đăng ký shop', async () => {
    profileResult.mockResolvedValue(profile('customer', true))
    const account = await fetchAccount(user({ id: 'user-locked' }))
    expect(rpc).not.toHaveBeenCalled()
    expect(account.isLocked).toBe(true)
  })

  it('RPC lỗi → ném lỗi và cho phép thử lại lần sau', async () => {
    profileResult.mockResolvedValue(profile('customer'))
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'EMAIL_NOT_CONFIRMED' } })
    await expect(fetchAccount(user({ id: 'user-retry' }))).rejects.toMatchObject({
      message: 'EMAIL_NOT_CONFIRMED',
    })
    await fetchAccount(user({ id: 'user-retry' }))
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
