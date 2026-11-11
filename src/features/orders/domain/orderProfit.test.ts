import { describe, expect, it } from 'vitest'
import { orderCogs } from './orderProfit'

describe('orderCogs', () => {
  it('cộng giá vốn đã chốt của các dòng', () => {
    expect(
      orderCogs([
        { quantity: 2, unit_cost: 90_000 },
        { quantity: 1, unit_cost: 100_000.5 },
      ]),
    ).toBe(280_001)
  })

  it('chưa chốt giá vốn (đơn chưa xác nhận) → null', () => {
    expect(orderCogs([{ quantity: 1, unit_cost: null }])).toBeNull()
    expect(orderCogs([])).toBeNull()
  })
})
