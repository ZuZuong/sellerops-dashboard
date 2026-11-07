import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authErrors'

describe('getAuthErrorMessage', () => {
  it.each([
    ['invalid_credentials', 'Email hoặc mật khẩu không đúng.'],
    ['email_not_confirmed', 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.'],
    ['user_banned', 'Tài khoản đã bị khóa.'],
    ['over_request_rate_limit', 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.'],
  ])('map mã %s sang tiếng Việt', (code, message) => {
    expect(getAuthErrorMessage(new AuthApiError('raw', 400, code))).toBe(message)
  })

  it('lỗi mạng của Supabase → thông báo kiểm tra kết nối', () => {
    expect(getAuthErrorMessage(new AuthRetryableFetchError('Failed to fetch', 0))).toMatch(
      /Không thể kết nối máy chủ/,
    )
  })

  it('TypeError (fetch thất bại) → thông báo kiểm tra kết nối', () => {
    expect(getAuthErrorMessage(new TypeError('Failed to fetch'))).toMatch(/Không thể kết nối/)
  })

  it('mã lạ hoặc lỗi không xác định → thông báo chung, không lộ thông điệp gốc', () => {
    expect(
      getAuthErrorMessage(new AuthApiError('internal detail', 500, 'unexpected_failure')),
    ).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.')
    expect(getAuthErrorMessage(new Error('boom'))).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.')
    expect(getAuthErrorMessage(null)).toBe('Đã có lỗi xảy ra. Vui lòng thử lại.')
  })
})
