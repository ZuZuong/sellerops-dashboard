import { describe, expect, it } from 'vitest'
import { loginSchema } from '@/features/auth/schemas/login.schema'

const firstIssue = (input: unknown) => {
  const result = loginSchema.safeParse(input)
  return result.success ? undefined : result.error.issues[0]
}

describe('loginSchema', () => {
  it('chấp nhận email và mật khẩu hợp lệ, cắt khoảng trắng của email', () => {
    expect(loginSchema.parse({ email: '  shop@example.com ', password: 'secret' })).toEqual({
      email: 'shop@example.com',
      password: 'secret',
    })
  })

  it('báo thiếu email', () => {
    expect(firstIssue({ email: '   ', password: 'secret' })).toMatchObject({
      path: ['email'],
      message: 'Vui lòng nhập email',
    })
  })

  it('báo email sai định dạng', () => {
    expect(firstIssue({ email: 'not-an-email', password: 'secret' })).toMatchObject({
      path: ['email'],
      message: 'Email không hợp lệ',
    })
  })

  it('báo thiếu mật khẩu', () => {
    expect(firstIssue({ email: 'shop@example.com', password: '' })).toMatchObject({
      path: ['password'],
      message: 'Vui lòng nhập mật khẩu',
    })
  })

  it('không cắt khoảng trắng của mật khẩu', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: ' pass ' }).password).toBe(' pass ')
  })

  it('chấp nhận tên tài khoản demo (không phân biệt hoa thường)', () => {
    expect(loginSchema.parse({ email: ' AdminTest ', password: 'x' }).email).toBe('admintest')
    expect(loginSchema.parse({ email: 'sellertest', password: 'x' }).email).toBe('sellertest')
  })

  it('tên đăng nhập khác không phải email vẫn báo sai định dạng', () => {
    expect(firstIssue({ email: 'admin', password: 'x' })).toMatchObject({
      path: ['email'],
      message: 'Email không hợp lệ',
    })
  })
})
