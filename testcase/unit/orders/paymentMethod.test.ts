import { describe, expect, it } from 'vitest'
import {
  getPaymentMethodLabel,
  isPaymentMethod,
  PAYMENT_METHOD_OPTIONS,
} from '@/features/orders/domain/paymentMethod'

describe('paymentMethod', () => {
  it('nhãn tiếng Việt; đơn cũ chưa có phương thức → "Không rõ"', () => {
    expect(getPaymentMethodLabel('bank_transfer')).toBe('Chuyển khoản ngân hàng')
    expect(getPaymentMethodLabel(null)).toBe('Không rõ')
  })

  it('isPaymentMethod chỉ nhận giá trị hỗ trợ', () => {
    expect(isPaymentMethod('cod')).toBe(true)
    expect(isPaymentMethod('bitcoin')).toBe(false)
    expect(isPaymentMethod(null)).toBe(false)
    expect(PAYMENT_METHOD_OPTIONS[0]).toEqual({
      value: 'cod',
      label: 'Thanh toán khi nhận hàng (COD)',
    })
  })
})
