import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CsvModule from '@/shared/lib/csv'
import { downloadCsv } from '@/shared/lib/csv'
import { renderWithProviders } from '@/test/render'
import {
  fetchRevenueByCategory,
  fetchRevenueByDay,
  fetchSalesSummary,
  fetchTopProductsByRange,
} from '../api/analytics.api'
import type { SalesSummary } from '../types'
import { AnalyticsView } from './AnalyticsView'

vi.mock('../api/analytics.api', () => ({
  fetchSalesSummary: vi.fn(),
  fetchRevenueByDay: vi.fn(),
  fetchRevenueByCategory: vi.fn(),
  fetchTopProductsByRange: vi.fn(),
}))

vi.mock('@/shared/lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof CsvModule>()),
  downloadCsv: vi.fn(),
}))

const api = {
  fetchSalesSummary: vi.mocked(fetchSalesSummary),
  fetchRevenueByDay: vi.mocked(fetchRevenueByDay),
  fetchRevenueByCategory: vi.mocked(fetchRevenueByCategory),
  fetchTopProductsByRange: vi.mocked(fetchTopProductsByRange),
}
const download = vi.mocked(downloadCsv)

const SUMMARY: SalesSummary = {
  revenue: 3_000_000,
  order_count: 10,
  items_sold: 25,
  cancelled_count: 2,
  prev_revenue: 2_000_000,
  prev_order_count: 10,
  prev_items_sold: 0,
  prev_cancelled_count: 1,
}

const DAYS = [
  { day: '2026-11-10', revenue: 1_000_000, order_count: 3 },
  { day: '2026-11-11', revenue: 2_000_000, order_count: 7 },
]

beforeEach(() => {
  // Chỉ giả lập Date ("hôm nay" = 11/11/2026 giờ VN), timer thật để userEvent / waitFor chạy bình thường.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-11T05:00:00Z'))
  Object.values(api).forEach((mock) => mock.mockReset())
  download.mockReset()
  api.fetchSalesSummary.mockResolvedValue(SUMMARY)
  api.fetchRevenueByDay.mockResolvedValue(DAYS)
  api.fetchRevenueByCategory.mockResolvedValue([
    { category: 'Áo thun', revenue: 2_000_000, quantity: 20 },
    { category: null, revenue: 1_000_000, quantity: 5 },
  ])
  api.fetchTopProductsByRange.mockResolvedValue([
    {
      product_id: 'p1',
      name: 'Áo thun basic',
      sku: 'DN-AO-001',
      quantity_sold: 20,
      revenue: 2_000_000,
    },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AnalyticsView', () => {
  it('mặc định 30 ngày gần nhất; KPI so sánh với kỳ trước', async () => {
    renderWithProviders(<AnalyticsView />, { route: '/analytics' })

    // Doanh thu 3tr vs 2tr và giá trị TB/đơn 300k vs 200k đều +50%.
    expect(await screen.findAllByText('+50%')).toHaveLength(2)
    expect(api.fetchSalesSummary).toHaveBeenCalledWith({ from: '2026-10-13', to: '2026-11-11' })
    expect(screen.getByText(/2 đơn bị hủy trong kỳ/)).toBeInTheDocument()
    // Giá trị TB/đơn: 300.000 ₫ (3tr / 10 đơn)
    expect(screen.getByText(/^300\.000\s₫$/)).toBeInTheDocument()
    // Kỳ trước bán 0 sản phẩm → không có mốc so sánh
    expect(screen.getByText('Chưa có dữ liệu kỳ trước')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '30 ngày' })).toBeChecked()
  })

  it('đọc khoảng tùy chọn từ URL và gửi đúng cho mọi widget', async () => {
    renderWithProviders(<AnalyticsView />, {
      route: '/analytics?range=custom&from=2026-09-01&to=2026-09-15',
    })
    const range = { from: '2026-09-01', to: '2026-09-15' }

    await screen.findByText('Áo thun basic')
    expect(api.fetchSalesSummary).toHaveBeenCalledWith(range)
    expect(api.fetchRevenueByDay).toHaveBeenCalledWith(range)
    expect(api.fetchRevenueByCategory).toHaveBeenCalledWith(range)
    expect(api.fetchTopProductsByRange).toHaveBeenCalledWith(range, 10)
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('2026-09-01')
    expect(screen.getByText(/15 ngày/)).toBeInTheDocument()
  })

  it('chọn preset "7 ngày" gọi lại API với khoảng mới', async () => {
    renderWithProviders(<AnalyticsView />, { route: '/analytics' })
    await screen.findByText('Áo thun basic')

    await userEvent.click(screen.getByRole('radio', { name: '7 ngày' }))
    await waitFor(() =>
      expect(api.fetchSalesSummary).toHaveBeenLastCalledWith({
        from: '2026-11-05',
        to: '2026-11-11',
      }),
    )
  })

  it('empty state khi không có doanh thu', async () => {
    api.fetchRevenueByDay.mockResolvedValue([{ day: '2026-11-11', revenue: 0, order_count: 0 }])
    api.fetchRevenueByCategory.mockResolvedValue([])
    api.fetchTopProductsByRange.mockResolvedValue([])
    renderWithProviders(<AnalyticsView />, { route: '/analytics' })

    expect(await screen.findByText('Chưa có doanh thu trong khoảng này')).toBeInTheDocument()
    expect(screen.getByText('Chưa có doanh thu theo danh mục')).toBeInTheDocument()
    expect(screen.getByText('Chưa có sản phẩm bán ra')).toBeInTheDocument()
  })

  it('một widget lỗi không ảnh hưởng widget khác; có nút thử lại', async () => {
    api.fetchRevenueByCategory.mockRejectedValueOnce(new Error('boom'))
    renderWithProviders(<AnalyticsView />, { route: '/analytics' })

    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    expect(await screen.findByText('Áo thun basic')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chưa phân loại')).toBeInTheDocument()
  })

  it('xuất CSV doanh thu theo ngày, tên file theo khoảng thời gian', async () => {
    renderWithProviders(<AnalyticsView />, { route: '/analytics?range=7d' })
    const button = await screen.findByRole('button', { name: 'Xuất CSV' })
    await waitFor(() => expect(button).toBeEnabled())

    await userEvent.click(button)
    expect(download).toHaveBeenCalledWith(
      'doanh-thu_2026-11-05_2026-11-11.csv',
      expect.stringContaining('2026-11-11,2000000,7'),
    )
  })
})
