import { describe, expect, it } from 'vitest'
import { parseAuthRedirect } from '@/features/auth/lib/authRedirect'

describe('parseAuthRedirect', () => {
  it('link đặt lại mật khẩu hợp lệ (luồng implicit, tham số trong hash)', () => {
    expect(parseAuthRedirect('#access_token=x&type=recovery', '')).toEqual({
      type: 'recovery',
      errorCode: null,
    })
  })

  it('link hết hạn: lấy error_code từ hash', () => {
    expect(
      parseAuthRedirect(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
        '',
      ),
    ).toEqual({ type: null, errorCode: 'otp_expired' })
  })

  it('lỗi trong query string, thiếu error_code thì dùng error', () => {
    expect(parseAuthRedirect('', '?error=server_error')).toEqual({
      type: null,
      errorCode: 'server_error',
    })
  })

  it('URL bình thường → không có gì', () => {
    expect(parseAuthRedirect('', '?status=pending')).toEqual({ type: null, errorCode: null })
  })
})
