import { describe, expect, it } from 'vitest'
import type { RevenueReportRow } from '@/features/analytics/types'
import { buildRevenueReport, revenueReportToXlsx } from '@/features/analytics/lib/revenueReport'

const row = (overrides: Partial<RevenueReportRow>): RevenueReportRow => ({
  order_id: 'o',
  code: 'DH-000001',
  created_at: '2026-11-10T03:00:00Z',
  customer_name: 'Khách',
  payment_method: 'cod',
  status: 'delivered',
  quantity: 1,
  revenue: 100_000,
  cogs: 60_000,
  ...overrides,
})

const rows = [
  row({ order_id: 'o1', revenue: 300_000, cogs: 200_000, quantity: 2 }),
  // 23:30 ngày 10/11 giờ VN (16:30Z) vẫn thuộc ngày 10/11.
  row({ order_id: 'o2', created_at: '2026-11-10T16:30:00Z', payment_method: 'bank_transfer' }),
  // 01:00 ngày 11/11 giờ VN = 18:00Z ngày 10/11.
  row({
    order_id: 'o3',
    created_at: '2026-11-10T18:00:00Z',
    payment_method: null,
    revenue: 50_000,
    cogs: 0,
  }),
]

describe('buildRevenueReport', () => {
  const report = buildRevenueReport(rows)

  it('tổng hợp doanh thu, giá vốn, lãi gộp, số lượng', () => {
    expect(report.totals).toEqual({
      orders: 3,
      quantity: 4,
      revenue: 450_000,
      cogs: 260_000,
      grossProfit: 190_000,
    })
  })

  it('nhóm theo ngày theo giờ Việt Nam', () => {
    expect(report.byDay.map((g) => [g.label, g.orders, g.revenue])).toEqual([
      ['10/11/2026', 2, 400_000],
      ['11/11/2026', 1, 50_000],
    ])
  })

  it('nhóm theo hình thức thanh toán (doanh thu giảm dần); đơn cũ → "Không rõ"', () => {
    expect(report.byPayment.map((g) => [g.key, g.revenue])).toEqual([
      ['cod', 300_000],
      ['bank_transfer', 100_000],
      ['unknown', 50_000],
    ])
    expect(report.byPayment[2]?.label).toBe('Không rõ')
  })
})

describe('revenueReportToXlsx', () => {
  it('ba sheet; bảng kê có lãi gộp và dòng cộng dạng công thức', () => {
    const sheets = revenueReportToXlsx(buildRevenueReport(rows), {
      companyName: 'SellerOps',
      range: { from: '2026-11-01', to: '2026-11-30' },
      generatedAt: new Date('2026-11-18T02:00:00Z'),
    })
    expect(sheets.map((s) => s.name)).toEqual(['Bảng kê', 'Theo ngày', 'Theo hình thức TT'])
    const detail = sheets[0]
    expect(detail?.rows[2]?.[0]).toBe('Kỳ báo cáo: từ ngày 01/11/2026 đến ngày 30/11/2026')
    expect(detail?.rows[6]).toEqual([
      1,
      '10/11/2026',
      'DH-000001',
      'Khách',
      'Thanh toán khi nhận hàng (COD)',
      'Đã giao',
      2,
      300_000,
      200_000,
      { kind: 'formula', f: 'H7-I7' },
    ])
    expect(detail?.rows[9]?.[7]).toEqual({ kind: 'formula', f: 'SUM(H7:H9)' })
  })
})
