import { describe, expect, it } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from '@/shared/lib/errors'
import { getProductErrorMessage, isDuplicateSkuError } from './productErrors'
import { toSearchTerm } from './search'

describe('toSearchTerm', () => {
  it('giữ nguyên từ khóa thường, kể cả tiếng Việt', () => {
    expect(toSearchTerm('Áo thun')).toBe('Áo thun')
  })

  it('loại ký tự đặc biệt của PostgREST và wildcard LIKE', () => {
    expect(toSearchTerm('a,b)(c')).toBe('a b c')
    expect(toSearchTerm('100%_off*')).toBe('100 off')
    expect(toSearchTerm('"x"\\y')).toBe('x y')
  })

  it('chuỗi chỉ có ký tự đặc biệt → rỗng', () => {
    expect(toSearchTerm(' %%, ')).toBe('')
  })
})

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
    expect(getProductErrorMessage(duplicate)).toBe('SKU đã tồn tại. Vui lòng dùng mã khác.')
    expect(isDuplicateSkuError(duplicate)).toBe(true)
    expect(getProductErrorMessage({ code: '23503', message: 'fk' })).toMatch(/Ngừng bán/)
  })

  it('lỗi khác → thông báo chung, không lộ chi tiết', () => {
    expect(getProductErrorMessage({ code: '42P01', message: 'relation does not exist' })).toBe(
      FALLBACK_ERROR_MESSAGE,
    )
    expect(isDuplicateSkuError(new Error('x'))).toBe(false)
  })
})
