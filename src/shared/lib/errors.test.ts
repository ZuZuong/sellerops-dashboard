import { describe, expect, it } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, getErrorMessage, NETWORK_ERROR_MESSAGE } from './errors'

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
