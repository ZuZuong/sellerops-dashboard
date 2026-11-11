import { describe, expect, it } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from '@/shared/lib/errors'
import { getProductErrorMessage } from './productErrors'

describe('getProductErrorMessage', () => {
  it('map mã lỗi RPC', () => {
    expect(getProductErrorMessage({ code: 'P0001', message: 'PRODUCT_IN_ORDERS' })).toMatch(
      /đã có trong đơn hàng/,
    )
    expect(getProductErrorMessage({ code: 'P0001', message: 'INSUFFICIENT_STOCK' })).toBe(
      'Tồn kho không đủ để giảm số lượng này.',
    )
  })

  it('map SQLSTATE', () => {
    const duplicate = { code: '23505', message: 'duplicate key value violates unique constraint' }
    expect(getProductErrorMessage(duplicate)).toBe('Mã SKU bị trùng. Vui lòng thử lại.')
    expect(getProductErrorMessage({ code: '23503', message: 'fk' })).toMatch(/Ngừng bán/)
  })

  it('lỗi khác → thông báo chung, không lộ chi tiết', () => {
    expect(getProductErrorMessage({ code: '42P01', message: 'relation does not exist' })).toBe(
      FALLBACK_ERROR_MESSAGE,
    )
  })
})
