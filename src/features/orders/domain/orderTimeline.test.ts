import { describe, expect, it } from 'vitest'
import { buildOrderTimeline } from './orderTimeline'

const T0 = '2026-11-10T01:00:00Z'
const T1 = '2026-11-10T02:00:00Z'
const T2 = '2026-11-11T03:00:00Z'

describe('buildOrderTimeline', () => {
  it('đơn đang giao: các bước đã qua có mốc thời gian, bước sau chưa tới', () => {
    expect(
      buildOrderTimeline(
        'shipping',
        [
          { status: 'shipping', created_at: T2 },
          { status: 'pending', created_at: T0 },
          { status: 'confirmed', created_at: T1 },
        ],
        T0,
      ),
    ).toEqual([
      { status: 'pending', at: T0, done: true },
      { status: 'confirmed', at: T1, done: true },
      { status: 'shipping', at: T2, done: true },
      { status: 'delivered', at: null, done: false },
    ])
  })

  it('thiếu lịch sử: bước pending lấy thời điểm tạo đơn', () => {
    expect(buildOrderTimeline('pending', [], T0)[0]).toEqual({
      status: 'pending',
      at: T0,
      done: true,
    })
  })

  it('đơn hủy sau khi xác nhận: chỉ hiện các bước đã qua rồi tới "Đã hủy"', () => {
    expect(
      buildOrderTimeline(
        'cancelled',
        [
          { status: 'pending', created_at: T0 },
          { status: 'confirmed', created_at: T1 },
          { status: 'cancelled', created_at: T2 },
        ],
        T0,
      ).map((step) => step.status),
    ).toEqual(['pending', 'confirmed', 'cancelled'])
  })
})
