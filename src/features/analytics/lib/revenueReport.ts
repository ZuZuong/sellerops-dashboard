import { getPaymentMethodLabel, ORDER_STATUS_META } from '@/features/orders'
import { toDateKey, type DateKey } from '@/shared/lib/dates'
import { formatDate, formatDateTime } from '@/shared/lib/formatters'
import { formula, type XlsxCell, type XlsxSheet } from '@/shared/lib/xlsxExport'
import type { ReportRange, RevenueReportRow } from '../types'

/**
 * Bảng kê doanh thu bán hàng: từng đơn ghi nhận doanh thu trong kỳ + tổng hợp theo ngày và theo
 * hình thức thanh toán. Doanh thu ghi nhận theo cùng quy tắc với các báo cáo khác (đơn đã xác
 * nhận / đang giao / đã giao, theo ngày tạo đơn).
 */

export interface RevenueTotals {
  orders: number
  quantity: number
  revenue: number
  cogs: number
  grossProfit: number
}

export interface RevenueGroup extends RevenueTotals {
  key: string
  label: string
}

export interface RevenueReport {
  rows: RevenueReportRow[]
  totals: RevenueTotals
  byDay: RevenueGroup[]
  byPayment: RevenueGroup[]
}

const emptyTotals = (): RevenueTotals => ({
  orders: 0,
  quantity: 0,
  revenue: 0,
  cogs: 0,
  grossProfit: 0,
})

function add(totals: RevenueTotals, row: RevenueReportRow) {
  totals.orders += 1
  totals.quantity += row.quantity
  totals.revenue += row.revenue
  totals.cogs += row.cogs
  totals.grossProfit += row.revenue - row.cogs
}

export function orderDateKey(row: Pick<RevenueReportRow, 'created_at'>): DateKey {
  return toDateKey(new Date(row.created_at))
}

export function buildRevenueReport(rows: readonly RevenueReportRow[]): RevenueReport {
  const totals = emptyTotals()
  const byDay = new Map<string, RevenueGroup>()
  const byPayment = new Map<string, RevenueGroup>()

  const group = (map: Map<string, RevenueGroup>, key: string, label: string) => {
    let entry = map.get(key)
    if (!entry) {
      entry = { key, label, ...emptyTotals() }
      map.set(key, entry)
    }
    return entry
  }

  for (const row of rows) {
    add(totals, row)
    const day = orderDateKey(row)
    add(group(byDay, day, formatDate(day)), row)
    const method = row.payment_method ?? 'unknown'
    add(group(byPayment, method, getPaymentMethodLabel(row.payment_method)), row)
  }

  return {
    rows: [...rows],
    totals,
    byDay: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byPayment: [...byPayment.values()].sort((a, b) => b.revenue - a.revenue),
  }
}

export const REVENUE_REPORT_SIGNERS = [
  'Người lập biểu',
  'Kế toán trưởng',
  'Chủ hộ kinh doanh / Giám đốc',
] as const

export const REVENUE_RECOGNITION_NOTE =
  'Doanh thu ghi nhận theo đơn đã xác nhận, đang giao và đã giao (theo ngày tạo đơn); không gồm đơn chờ xác nhận và đơn đã hủy. Số tiền tính bằng đồng Việt Nam.'

export interface RevenueReportMeta {
  companyName: string
  range: ReportRange
  generatedAt: Date
}

const periodLabel = (range: ReportRange) =>
  `Kỳ báo cáo: từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)}`

/** Sheet "Bảng kê" (từng đơn, có dòng cộng dùng công thức SUM) + "Theo ngày" + "Theo hình thức TT". */
export function revenueReportToXlsx(report: RevenueReport, meta: RevenueReportMeta): XlsxSheet[] {
  const header: XlsxCell[][] = [
    [meta.companyName],
    ['BẢNG KÊ DOANH THU BÁN HÀNG HÓA'],
    [periodLabel(meta.range)],
    [`Lập lúc: ${formatDateTime(meta.generatedAt)}`],
    [],
  ]

  const detailHead = [
    'STT',
    'Ngày chứng từ',
    'Số chứng từ (mã đơn)',
    'Khách hàng',
    'Hình thức thanh toán',
    'Trạng thái',
    'Số lượng',
    'Doanh thu',
    'Giá vốn',
    'Lãi gộp',
  ]
  const firstRow = header.length + 2
  const detailRows: XlsxCell[][] = report.rows.map((row, i) => {
    const r = firstRow + i
    return [
      i + 1,
      formatDate(orderDateKey(row)),
      row.code,
      row.customer_name,
      getPaymentMethodLabel(row.payment_method),
      ORDER_STATUS_META[row.status].label,
      row.quantity,
      row.revenue,
      row.cogs,
      formula(`H${r}-I${r}`),
    ]
  })
  const lastRow = firstRow + report.rows.length - 1
  const sum = (col: string, fallback: number) =>
    report.rows.length > 0 ? formula(`SUM(${col}${firstRow}:${col}${lastRow})`) : fallback
  const detail: XlsxSheet = {
    name: 'Bảng kê',
    rows: [
      ...header,
      detailHead,
      ...detailRows,
      ['Cộng', null, null, null, null, null, sum('G', 0), sum('H', 0), sum('I', 0), sum('J', 0)],
      [],
      [REVENUE_RECOGNITION_NOTE],
      [],
      [
        REVENUE_REPORT_SIGNERS[0],
        null,
        null,
        REVENUE_REPORT_SIGNERS[1],
        null,
        null,
        REVENUE_REPORT_SIGNERS[2],
      ],
      ['(Ký, họ tên)', null, null, '(Ký, họ tên)', null, null, '(Ký, họ tên, đóng dấu)'],
    ],
    columnWidths: [6, 14, 20, 28, 30, 14, 10, 16, 16, 16],
    merges: ['A1:J1', 'A2:J2', 'A3:J3', 'A4:J4', `A${lastRow + 1}:F${lastRow + 1}`],
  }

  const groupSheet = (
    name: string,
    firstHead: string,
    groups: readonly RevenueGroup[],
  ): XlsxSheet => {
    const top = header.length + 2
    return {
      name,
      rows: [
        ...header,
        [firstHead, 'Số đơn', 'Số lượng', 'Doanh thu', 'Giá vốn', 'Lãi gộp'],
        ...groups.map((g) => [g.label, g.orders, g.quantity, g.revenue, g.cogs, g.grossProfit]),
        [
          'Cộng',
          ...['B', 'C', 'D', 'E', 'F'].map((col) =>
            groups.length > 0 ? formula(`SUM(${col}${top}:${col}${top + groups.length - 1})`) : 0,
          ),
        ],
      ],
      columnWidths: [30, 10, 12, 16, 16, 16],
      merges: ['A1:F1', 'A2:F2', 'A3:F3', 'A4:F4'],
    }
  }

  return [
    detail,
    groupSheet('Theo ngày', 'Ngày', report.byDay),
    groupSheet('Theo hình thức TT', 'Hình thức thanh toán', report.byPayment),
  ]
}
