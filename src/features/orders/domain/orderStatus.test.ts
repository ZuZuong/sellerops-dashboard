import { describe, expect, it } from 'vitest'
import {
  assertTransition,
  canTransition,
  getNextStatuses,
  getStockEffect,
  InvalidTransitionError,
  isFinalStatus,
  ORDER_STATUSES,
  type OrderStatus,
} from './orderStatus'

const VALID: ReadonlyArray<[OrderStatus, OrderStatus]> = [
  ['pending', 'confirmed'],
  ['pending', 'cancelled'],
  ['confirmed', 'shipping'],
  ['confirmed', 'cancelled'],
  ['shipping', 'delivered'],
]

const isValid = (from: OrderStatus, to: OrderStatus) =>
  VALID.some(([f, t]) => f === from && t === to)

// Mọi cặp (from, to) không nằm trong VALID — gồm cả nhảy cóc, đi lùi và chuyển sang chính nó.
const INVALID = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.filter((to) => !isValid(from, to)).map((to) => [from, to] as const),
)

describe('order state machine', () => {
  it.each(VALID)('cho phép %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
    expect(() => assertTransition(from, to)).not.toThrow()
  })

  it.each(INVALID)('chặn %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
    expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError)
  })

  it('kiểm tra đủ 25 cặp trạng thái', () => {
    expect(VALID.length + INVALID.length).toBe(ORDER_STATUSES.length ** 2)
  })

  it('không cho hủy đơn đang giao hoặc đã giao', () => {
    expect(canTransition('shipping', 'cancelled')).toBe(false)
    expect(canTransition('delivered', 'cancelled')).toBe(false)
  })

  it('trạng thái cuối không có thao tác tiếp theo', () => {
    expect(isFinalStatus('delivered')).toBe(true)
    expect(isFinalStatus('cancelled')).toBe(true)
    expect(isFinalStatus('pending')).toBe(false)
    expect(getNextStatuses('delivered')).toEqual([])
  })

  it('lỗi chuyển trạng thái mang mã nghiệp vụ để map thông báo', () => {
    expect(() => assertTransition('delivered', 'pending')).toThrow('INVALID_STATUS_TRANSITION')
  })
})

describe('getStockEffect', () => {
  it('xác nhận đơn trừ kho', () => {
    expect(getStockEffect('pending', 'confirmed')).toBe('deduct')
  })

  it('hủy đơn đã xác nhận hoàn kho; hủy đơn chờ xác nhận không đổi kho', () => {
    expect(getStockEffect('confirmed', 'cancelled')).toBe('restock')
    expect(getStockEffect('pending', 'cancelled')).toBe('none')
  })

  it('giao hàng không đổi kho; chuyển không hợp lệ không có tác động', () => {
    expect(getStockEffect('confirmed', 'shipping')).toBe('none')
    expect(getStockEffect('shipping', 'delivered')).toBe('none')
    expect(getStockEffect('delivered', 'cancelled')).toBe('none')
  })
})
