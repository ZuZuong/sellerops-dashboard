import { describe, expect, it } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from '@/shared/lib/errors'
import { InvalidTransitionError } from '../domain/orderStatus'
import { getOrderErrorMessage } from './orderErrors'
import { calcOrderTotal, lineTotal } from './orderTotal'

describe('calcOrderTotal', () => {
  it('cộng thành tiền các dòng', () => {
    expect(
      calcOrderTotal([
        { price: 150_000, quantity: 2 },
        { price: 99_000, quantity: 1 },
      ]),
    ).toBe(399_000)
  })

  it('dòng chưa chọn sản phẩm / chưa nhập số lượng tính 0', () => {
    expect(lineTotal({ price: null, quantity: 3 })).toBe(0)
    expect(lineTotal({ price: 100, quantity: undefined })).toBe(0)
    expect(calcOrderTotal([])).toBe(0)
  })
})

describe('getOrderErrorMessage', () => {
  const rpcError = (message: string, details: string | null = null) => ({
    code: 'P0001',
    message,
    details,
  })

  it('map mã lỗi RPC sang tiếng Việt', () => {
    expect(getOrderErrorMessage(rpcError('INSUFFICIENT_STOCK'))).toMatch(/Không đủ tồn kho/)
    expect(getOrderErrorMessage(rpcError('ORDER_NOT_PENDING'))).toMatch(/chờ xác nhận/)
  })

  it('nêu tên sản phẩm thiếu hàng khi biết product_id', () => {
    const names = new Map([['p1', 'Áo thun basic']])
    expect(getOrderErrorMessage(rpcError('INSUFFICIENT_STOCK', 'p1'), names)).toBe(
      'Không đủ tồn kho cho "Áo thun basic". Hãy nhập thêm hàng hoặc giảm số lượng rồi xác nhận lại.',
    )
    // product_id lạ → thông báo chung
    expect(getOrderErrorMessage(rpcError('INSUFFICIENT_STOCK', 'p9'), names)).toMatch(
      /^Không đủ tồn kho để xác nhận đơn/,
    )
  })

  it('lỗi chuyển trạng thái chặn ở client cũng có thông báo', () => {
    expect(getOrderErrorMessage(new InvalidTransitionError('delivered', 'cancelled'))).toMatch(
      /Không thể chuyển đơn/,
    )
  })

  it('không lộ chi tiết kỹ thuật với lỗi lạ', () => {
    expect(getOrderErrorMessage({ code: 'XX000', message: 'internal' })).toBe(
      FALLBACK_ERROR_MESSAGE,
    )
  })
})
