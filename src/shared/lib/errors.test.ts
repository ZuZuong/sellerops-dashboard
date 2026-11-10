import { describe, expect, it } from 'vitest'
import {
  FALLBACK_ERROR_MESSAGE,
  getDbErrorInfo,
  getErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from './errors'

describe('getErrorMessage', () => {
  it('nhận diện lỗi mạng', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR_MESSAGE)
    expect(getErrorMessage(new Error('TypeError: NetworkError when attempting'))).toBe(
      NETWORK_ERROR_MESSAGE,
    )
  })

  it('không lộ chi tiết kỹ thuật với lỗi khác', () => {
    expect(getErrorMessage(new Error('relation "orders" does not exist'))).toBe(
      FALLBACK_ERROR_MESSAGE,
    )
    expect(getErrorMessage({ code: 'PGRST301' })).toBe(FALLBACK_ERROR_MESSAGE)
    expect(getErrorMessage(undefined)).toBe(FALLBACK_ERROR_MESSAGE)
  })
})

describe('getDbErrorInfo', () => {
  it('đọc code và message từ lỗi PostgREST', () => {
    expect(getDbErrorInfo({ code: '23505', message: 'duplicate key', details: null })).toEqual({
      code: '23505',
      message: 'duplicate key',
    })
  })

  it('trả null với giá trị không phải object lỗi', () => {
    expect(getDbErrorInfo('boom')).toEqual({ code: null, message: null })
    expect(getDbErrorInfo(null)).toEqual({ code: null, message: null })
    expect(getDbErrorInfo({ code: 42 })).toEqual({ code: null, message: null })
  })
})
