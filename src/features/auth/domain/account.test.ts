import { describe, expect, it } from 'vitest'
import { homePathForRole, resolveRoleAccess, type Account } from './account'

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'u1',
  email: 'a@example.com',
  role: 'seller',
  fullName: null,
  isLocked: false,
  lockedReason: null,
  ...overrides,
})

describe('homePathForRole', () => {
  it('admin → /admin, seller → /seller, customer → không có quyền', () => {
    expect(homePathForRole('admin')).toBe('/admin')
    expect(homePathForRole('seller')).toBe('/seller')
    expect(homePathForRole('customer')).toBe('/no-access')
  })
})

describe('resolveRoleAccess', () => {
  it('đúng vai trò → cho vào', () => {
    expect(resolveRoleAccess(account(), ['seller'])).toEqual({ kind: 'allowed' })
    expect(resolveRoleAccess(account({ role: 'admin' }), ['admin', 'seller'])).toEqual({
      kind: 'allowed',
    })
  })

  it('sai vai trò → chuyển về trang chủ của vai trò đó', () => {
    expect(resolveRoleAccess(account({ role: 'admin' }), ['seller'])).toEqual({
      kind: 'redirect',
      to: '/admin',
    })
    expect(resolveRoleAccess(account({ role: 'customer' }), ['seller'])).toEqual({
      kind: 'redirect',
      to: '/no-access',
    })
  })

  it('tài khoản khóa luôn bị chặn, kể cả đúng vai trò', () => {
    expect(resolveRoleAccess(account({ isLocked: true }), ['seller'])).toEqual({ kind: 'locked' })
  })
})
