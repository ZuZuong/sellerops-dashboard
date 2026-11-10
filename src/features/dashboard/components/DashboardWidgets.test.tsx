import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  fetchDashboardKpis,
  fetchRecentOrders,
  fetchRevenueSeries,
  fetchTopProducts,
} from '../api/dashboard.api'
import type { DashboardKpis, RecentOrder, RevenuePoint, TopProduct } from '../types'
import { DashboardOverview } from './DashboardOverview'
import { KpiCards } from './KpiCards'
import { RecentOrders } from './RecentOrders'
import { RevenueChart } from './RevenueChart'
import { TopProducts } from './TopProducts'

vi.mock('../api/dashboard.api', () => ({
  fetchDashboardKpis: vi.fn(),
  fetchRevenueSeries: vi.fn(),
  fetchTopProducts: vi.fn(),
  fetchRecentOrders: vi.fn(),
}))

const kpisMock = vi.mocked(fetchDashboardKpis)
const seriesMock = vi.mocked(fetchRevenueSeries)
const topMock = vi.mocked(fetchTopProducts)
const recentMock = vi.mocked(fetchRecentOrders)

const kpis: DashboardKpis = {
  revenue: 15_000_000,
  prev_revenue: 10_000_000,
  order_count: 42,
  prev_order_count: 0,
  pending_count: 3,
  low_stock_count: 2,
}

const series: RevenuePoint[] = [
  { day: '2026-11-08', revenue: 0, order_count: 0 },
  { day: '2026-11-09', revenue: 1_200_000, order_count: 2 },
  { day: '2026-11-10', revenue: 800_000, order_count: 1 },
]

const topProducts: TopProduct[] = [
  { product_id: 'p1', name: 'Áo thun basic', sku: 'AT-01', quantity_sold: 30, revenue: 4_500_000 },
  { product_id: 'p2', name: 'Quần jean', sku: 'QJ-02', quantity_sold: 12, revenue: 5_400_000 },
]

const recentOrders: RecentOrder[] = [
  {
    id: 'o1',
    code: 'DH-0001',
    customer_name: 'Nguyễn Văn A',
    status: 'pending',
    total: 350_000,
    created_at: '2026-11-10T03:15:00Z',
  },
]

/** Promise không bao giờ resolve → giữ query ở trạng thái loading. */
const never = <T,>() => new Promise<T>(() => {})
const normalize = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  kpisMock.mockReset()
  seriesMock.mockReset()
  topMock.mockReset()
  recentMock.mockReset()
})

describe('KpiCards', () => {
  it('hiện skeleton khi đang tải', () => {
    kpisMock.mockReturnValue(never())
    renderWithProviders(<KpiCards days={30} />, { route: '/' })
    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4)
  })

  it('hiện 4 chỉ số và % thay đổi so với kỳ trước', async () => {
    kpisMock.mockResolvedValue(kpis)
    renderWithProviders(<KpiCards days={30} />, { route: '/' })

    expect(await screen.findByText('Doanh thu · 30 ngày qua')).toBeInTheDocument()
    expect(normalize(screen.getByText(/15\.000\.000/).textContent)).toBe('15.000.000 ₫')
    expect(screen.getByText('+50%')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    // Kỳ trước = 0 đơn → không hiện phần trăm vô nghĩa
    expect(screen.getByText('Chưa có dữ liệu kỳ trước')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem đơn chờ xác nhận' })).toHaveAttribute(
      'href',
      '/orders?status=pending',
    )
    expect(kpisMock).toHaveBeenCalledWith(30)
  })

  it('hiện lỗi và cho phép thử lại', async () => {
    kpisMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(kpis)
    renderWithProviders(<KpiCards days={7} />, { route: '/' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Không thể kết nối máy chủ')

    await userEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Doanh thu · 7 ngày qua')).toBeInTheDocument()
    expect(kpisMock).toHaveBeenCalledTimes(2)
  })
})

describe('RevenueChart', () => {
  it('hiện skeleton khi đang tải', () => {
    seriesMock.mockReturnValue(never())
    renderWithProviders(<RevenueChart days={7} />)
    expect(screen.getByTestId('revenue-chart-skeleton')).toBeInTheDocument()
  })

  it('hiện empty state khi không có doanh thu', async () => {
    seriesMock.mockResolvedValue(series.map((p) => ({ ...p, revenue: 0, order_count: 0 })))
    renderWithProviders(<RevenueChart days={7} />)
    expect(await screen.findByText('Chưa có doanh thu trong 7 ngày qua')).toBeInTheDocument()
  })

  it('hiện tổng doanh thu, biểu đồ có nhãn và bảng dữ liệu cho trình đọc màn hình', async () => {
    seriesMock.mockResolvedValue(series)
    renderWithProviders(<RevenueChart days={7} />)

    expect(
      await screen.findByRole('img', {
        name: 'Biểu đồ doanh thu theo ngày từ 08/11/2026 đến 10/11/2026',
      }),
    ).toBeInTheDocument()
    expect(normalize(screen.getByText(/2\.000\.000/).textContent)).toBe('2.000.000 ₫')
    expect(screen.getByText(/từ 3 đơn đã xác nhận/)).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Doanh thu theo ngày' })
    expect(within(table).getAllByRole('row')).toHaveLength(series.length + 1)
  })

  it('hiện lỗi khi tải thất bại', async () => {
    seriesMock.mockRejectedValue(new Error('boom'))
    renderWithProviders(<RevenueChart days={7} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã có lỗi xảy ra')
  })
})

describe('TopProducts', () => {
  it('liệt kê sản phẩm theo thứ tự từ RPC', async () => {
    topMock.mockResolvedValue(topProducts)
    renderWithProviders(<TopProducts days={30} />)

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Áo thun basic')
    expect(items[0]).toHaveTextContent('30 đã bán')
    expect(topMock).toHaveBeenCalledWith(30, 5)
  })

  it('hiện empty state khi chưa bán được gì', async () => {
    topMock.mockResolvedValue([])
    renderWithProviders(<TopProducts days={30} />)
    expect(
      await screen.findByText('Chưa bán được sản phẩm nào trong 30 ngày qua'),
    ).toBeInTheDocument()
  })
})

describe('RecentOrders', () => {
  it('hiện bảng đơn gần đây với nhãn trạng thái tiếng Việt', async () => {
    recentMock.mockResolvedValue(recentOrders)
    renderWithProviders(<RecentOrders />, { route: '/' })

    const row = (await screen.findByText('DH-0001')).closest('tr')
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent('Nguyễn Văn A')
    expect(row).toHaveTextContent('Chờ xác nhận')
    expect(row).toHaveTextContent('10/11/2026 10:15')
  })

  it('hiện empty state có hướng dẫn hành động tiếp theo', async () => {
    recentMock.mockResolvedValue([])
    renderWithProviders(<RecentOrders />, { route: '/' })
    expect(await screen.findByText('Chưa có đơn hàng nào')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Đến trang đơn hàng' })).toHaveAttribute(
      'href',
      '/orders',
    )
  })
})

describe('DashboardOverview', () => {
  it('một widget lỗi không ảnh hưởng các widget khác', async () => {
    kpisMock.mockResolvedValue(kpis)
    seriesMock.mockRejectedValue(new Error('boom'))
    topMock.mockResolvedValue(topProducts)
    recentMock.mockResolvedValue(recentOrders)
    renderWithProviders(<DashboardOverview />, { route: '/' })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(await screen.findByText('Doanh thu · 30 ngày qua')).toBeInTheDocument()
    expect(await screen.findByText('Áo thun basic')).toBeInTheDocument()
    expect(await screen.findByText('DH-0001')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('đọc khoảng thời gian từ URL', async () => {
    kpisMock.mockResolvedValue(kpis)
    seriesMock.mockResolvedValue(series)
    topMock.mockResolvedValue(topProducts)
    recentMock.mockResolvedValue(recentOrders)
    renderWithProviders(<DashboardOverview />, { route: '/?range=7d' })

    expect(await screen.findByText('Doanh thu · 7 ngày qua')).toBeInTheDocument()
    expect(kpisMock).toHaveBeenCalledWith(7)
    expect(seriesMock).toHaveBeenCalledWith(7)
    expect(topMock).toHaveBeenCalledWith(7, 5)
  })
})
