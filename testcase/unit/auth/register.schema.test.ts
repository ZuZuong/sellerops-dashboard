import { describe, expect, it } from 'vitest'
import { passwordPairSchema } from '@/features/auth/schemas/password.schema'
import { forgotPasswordSchema, registerSchema } from '@/features/auth/schemas/register.schema'

const valid = {
  fullName: '  Nguyễn Văn A ',
  email: ' Shop@Example.com ',
  password: 'matkhau123',
  confirmPassword: 'matkhau123',
}

const errorsOf = (input: Record<string, unknown>) => {
  const result = registerSchema.safeParse({ ...valid, ...input })
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}

describe('registerSchema', () => {
  it('hợp lệ: cắt khoảng trắng họ tên / email', () => {
    const parsed = registerSchema.parse(valid)
    expect(parsed.fullName).toBe('Nguyễn Văn A')
    expect(parsed.email).toBe('Shop@Example.com')
  })

  it('mật khẩu tối thiểu 8, tối đa 72 ký tự', () => {
    expect(errorsOf({ password: '1234567', confirmPassword: '1234567' }).password).toBe(
      'Mật khẩu tối thiểu 8 ký tự',
    )
    const long = 'a'.repeat(73)
    expect(errorsOf({ password: long, confirmPassword: long }).password).toBe(
      'Mật khẩu tối đa 72 ký tự',
    )
  })

  it('mật khẩu nhập lại phải khớp', () => {
    expect(errorsOf({ confirmPassword: 'khac12345' }).confirmPassword).toBe(
      'Mật khẩu nhập lại không khớp',
    )
  })

  it('bắt buộc họ tên, email hợp lệ', () => {
    expect(errorsOf({ fullName: ' ' }).fullName).toBe('Vui lòng nhập họ tên (ít nhất 2 ký tự)')
    expect(errorsOf({ email: 'khong-phai-email' }).email).toBe('Email không hợp lệ')
    expect(errorsOf({ email: '' }).email).toBe('Vui lòng nhập email')
  })
})

describe('passwordPairSchema / forgotPasswordSchema', () => {
  it('đặt lại mật khẩu: cùng quy tắc với đăng ký', () => {
    expect(passwordPairSchema.safeParse({ password: 'abc', confirmPassword: 'abc' }).success).toBe(
      false,
    )
    expect(
      passwordPairSchema.safeParse({ password: 'abcdefgh', confirmPassword: 'abcdefgh' }).success,
    ).toBe(true)
  })

  it('quên mật khẩu chỉ cần email hợp lệ', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.vn' }).success).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: 'a@' }).success).toBe(false)
  })
})
