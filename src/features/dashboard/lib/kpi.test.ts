import { describe, expect, it } from 'vitest'
import { summarizeSeries } from './kpi'

describe('summarizeSeries', () => {
  it('cộng dồn doanh thu và số đơn', () => {
    expect(
      summarizeSeries([
        { revenue: 100_000, order_count: 1 },
        { revenue: 0, order_count: 0 },
        { revenue: 250_000, order_count: 2 },
      ]),
    ).toEqual({ revenue: 350_000, orderCount: 3 })
  })

  it('chuỗi rỗng trả 0', () => {
    expect(summarizeSeries([])).toEqual({ revenue: 0, orderCount: 0 })
  })
})
