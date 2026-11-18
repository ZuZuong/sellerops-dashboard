import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as XlsxModule from '@/shared/lib/xlsxExport'
import { downloadXlsx } from '@/shared/lib/xlsxExport'
import { renderWithProviders } from '@/test/render'
import { fetchRevenueReport } from '../api/analytics.api'
import type { RevenueReportRow } from '../types'
import { RevenueReportView } from './RevenueReportView'

vi.mock('../api/analytics.api', () => ({
  fetchRevenueReport: vi.fn(),
}))

vi.mock('@/shared/lib/xlsxExport', async (importOriginal) => ({
  ...(await importOriginal<typeof XlsxModule>()),
  downloadXlsx: vi.fn(() => Promise.resolve()),
}))

const fetchReport = vi.mocked(fetchRevenueReport)

const ROWS: RevenueReportRow[] = [
  {
    order_id: 'o1',
    code: 'DH-000010',
    created_at: '2026-11-05T03:00:00Z',
    customer_name: 'Nguyễn Văn A',
    payment_method: 'bank_transfer',
    status: 'delivered',
    quantity: 2,
    revenue: 1_250_000,
    cogs: 800_000,
  },
]

const ROUTE = '/analytics/revenue-report?range=custom&from=2026-11-01&to=2026-11-15'

beforeEach(() => {
  fetchReport.mockReset()
  vi.mocked(downloadXlsx).mockClear()
})

describe('RevenueReportView', () => {
  it('hiện skeleton khi đang tải', () => {
    fetchReport.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<RevenueReportView />, { route: ROUTE })
    expect(screen.getByTestId('revenue-report-skeleton')).toBeInTheDocument()
  })

  it('lấy đúng kỳ trên URL; hiện tổng hợp, bảng kê và số tiền bằng chữ', async () => {
    fetchReport.mockResolvedValue(ROWS)
    renderWithProviders(<RevenueReportView />, { route: ROUTE })

    expect(
      await screen.findByRole('heading', { name: 'BẢNG KÊ DOANH THU BÁN HÀNG HÓA' }),
    ).toBeInTheDocument()
    expect(fetchReport).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-15' })
    expect(
      screen.getByText('Kỳ báo cáo: từ ngày 01/11/2026 đến ngày 15/11/2026'),
    ).toBeInTheDocument()
    expect(screen.getByText('DH-000010').closest('tr')).toHaveTextContent(/1\.250\.000/)
    expect(screen.getByText(/Chuyển khoản ngân hàng \(1 đơn\)/)).toBeInTheDocument()
    expect(screen.getByText(/Một triệu hai trăm năm mươi nghìn đồng/i)).toBeInTheDocument()
  })

  it('tải Excel ba sheet', async () => {
    fetchReport.mockResolvedValue(ROWS)
    renderWithProviders(<RevenueReportView />, { route: ROUTE })

    await userEvent.click(await screen.findByRole('button', { name: 'Tải Excel' }))
    await waitFor(() => expect(downloadXlsx).toHaveBeenCalledTimes(1))
    const [filename, sheets] = vi.mocked(downloadXlsx).mock.calls[0] ?? []
    expect(filename).toBe('bang-ke-doanh-thu-2026-11-01_2026-11-15.xlsx')
    expect(sheets).toHaveLength(3)
  })

  it('empty state khi kỳ không có doanh thu', async () => {
    fetchReport.mockResolvedValue([])
    renderWithProviders(<RevenueReportView />, { route: ROUTE })
    expect(await screen.findByText('Chưa có doanh thu trong kỳ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải Excel' })).toBeDisabled()
  })

  it('error state có nút thử lại', async () => {
    fetchReport.mockRejectedValueOnce(new Error('boom'))
    fetchReport.mockResolvedValueOnce(ROWS)
    renderWithProviders(<RevenueReportView />, { route: ROUTE })

    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('DH-000010')).toBeInTheDocument()
  })
})
