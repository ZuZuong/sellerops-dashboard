import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Notifications } from '@mantine/notifications'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { fetchOrderDetail, transitionOrder } from '../api/orders.api'
import type { OrderDetail } from '../types'
import { OrderDetailView } from './OrderDetailView'

vi.mock('../api/orders.api', () => ({
  fetchOrders: vi.fn(),
  fetchOrderDetail: vi.fn(),
  searchOrderableProducts: vi.fn(),
  createOrder: vi.fn(),
  transitionOrder: vi.fn(),
}))

const api = {
  fetchOrderDetail: vi.mocked(fetchOrderDetail),
  transitionOrder: vi.mocked(transitionOrder),
}

const ORDER_ID = '7f3c2a10-0000-4000-8000-000000000001'

const makeOrder = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: ORDER_ID,
  code: 'DH-000123',
  customer_name: 'Trần Thị B',
  customer_phone: '0901234567',
  status: 'pending',
  total: 450_000,
  created_at: '2026-11-10T02:00:00Z',
  items: [
    {
      id: 'i1',
      product_id: 'p1',
      quantity: 2,
      unit_price: 150_000,
      unit_cost: null,
      product: {
        id: 'p1',
        name: 'Áo thun basic',
        sku: 'DN-AOTHUNBASIC-001',
        stock: 10,
        is_active: true,
      },
    },
    {
      id: 'i2',
      product_id: 'p2',
      quantity: 1,
      unit_price: 150_000,
      unit_cost: null,
      product: { id: 'p2', name: 'Quần jean', sku: 'DN-QUANJEAN-002', stock: 5, is_active: true },
    },
  ],
  events: [{ id: 'e1', status: 'pending', created_at: '2026-11-10T02:00:00Z' }],
  ...overrides,
})

const renderDetail = () =>
  renderWithProviders(
    <>
      <Notifications />
      <OrderDetailView orderId={ORDER_ID} />
    </>,
    { route: `/orders/${ORDER_ID}` },
  )

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})

describe('OrderDetailView', () => {
  it('hiện skeleton khi đang tải', () => {
    api.fetchOrderDetail.mockReturnValue(new Promise(() => {}))
    renderDetail()
    expect(screen.getByTestId('order-detail-skeleton')).toBeInTheDocument()
  })

  it('hiện thông tin, dòng hàng với giá chốt và timeline', async () => {
    api.fetchOrderDetail.mockResolvedValue(makeOrder())
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'DH-000123' })).toBeInTheDocument()
    const row = screen.getByText('Áo thun basic').closest('tr')
    expect(row).toHaveTextContent(/300\.000\s₫/)
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
    expect(
      screen.getByText('Chờ xác nhận', { selector: '.mantine-Timeline-itemTitle' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Chưa tới bước này')).toHaveLength(3)
  })

  it('đơn không tồn tại → empty state; id sai định dạng không gọi API', async () => {
    api.fetchOrderDetail.mockResolvedValue(null)
    const first = renderDetail()
    expect(await screen.findByText('Không tìm thấy đơn hàng')).toBeInTheDocument()
    first.unmount()

    renderWithProviders(<OrderDetailView orderId="abc" />, { route: '/orders/abc' })
    expect(screen.getByText('Không tìm thấy đơn hàng')).toBeInTheDocument()
    expect(api.fetchOrderDetail).toHaveBeenCalledTimes(1)
  })

  it('chỉ hiện thao tác hợp lệ theo trạng thái', async () => {
    api.fetchOrderDetail.mockResolvedValue(makeOrder({ status: 'shipping' }))
    const first = renderDetail()
    expect(await screen.findByRole('button', { name: 'Đã giao thành công' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument()
    first.unmount()

    api.fetchOrderDetail.mockResolvedValue(makeOrder({ status: 'delivered' }))
    renderDetail()
    await screen.findByRole('heading', { name: 'DH-000123' })
    expect(screen.queryByRole('button', { name: /Xác nhận|Hủy đơn|Giao hàng/ })).toBeNull()
  })

  describe('luồng xác nhận đơn', () => {
    it('cần xác nhận trong hộp thoại, gọi RPC rồi tải lại đơn', async () => {
      api.fetchOrderDetail.mockResolvedValueOnce(makeOrder())
      api.fetchOrderDetail.mockResolvedValue(makeOrder({ status: 'confirmed' }))
      api.transitionOrder.mockResolvedValue()
      renderDetail()

      await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận đơn' }))
      const dialog = await screen.findByRole('dialog', { name: 'Xác nhận đơn hàng?' })
      // Hộp thoại nêu rõ tác động kho của từng sản phẩm.
      expect(dialog).toHaveTextContent('Áo thun basic: −2')
      expect(api.transitionOrder).not.toHaveBeenCalled()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận đơn' }))

      await waitFor(() =>
        expect(api.transitionOrder).toHaveBeenCalledWith(ORDER_ID, 'pending', 'confirmed'),
      )
      expect(await screen.findByText('Đã xác nhận đơn hàng')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      // Sau khi làm mới: đơn đã xác nhận → có nút "Giao hàng", không còn "Xác nhận đơn".
      expect(await screen.findByRole('button', { name: 'Giao hàng' })).toBeInTheDocument()
    })

    it('thiếu hàng (INSUFFICIENT_STOCK) → thông báo tiếng Việt nêu tên sản phẩm', async () => {
      api.fetchOrderDetail.mockResolvedValue(makeOrder())
      api.transitionOrder.mockRejectedValue({
        code: 'P0001',
        message: 'INSUFFICIENT_STOCK',
        details: 'p2',
      })
      renderDetail()

      await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận đơn' }))
      const dialog = await screen.findByRole('dialog', { name: 'Xác nhận đơn hàng?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận đơn' }))

      expect(await screen.findByText(/Không đủ tồn kho cho "Quần jean"/)).toBeInTheDocument()
      expect(screen.getByText('Không cập nhật được đơn DH-000123')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      // Đơn vẫn chờ xác nhận, có thể thử lại.
      expect(screen.getByRole('button', { name: 'Xác nhận đơn' })).toBeEnabled()
    })

    it('đơn đã được xử lý ở nơi khác (ORDER_NOT_PENDING) → thông báo phù hợp', async () => {
      api.fetchOrderDetail.mockResolvedValue(makeOrder())
      api.transitionOrder.mockRejectedValue({ code: 'P0001', message: 'ORDER_NOT_PENDING' })
      renderDetail()

      await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận đơn' }))
      const dialog = await screen.findByRole('dialog', { name: 'Xác nhận đơn hàng?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận đơn' }))

      expect(await screen.findByText(/không còn ở trạng thái chờ xác nhận/)).toBeInTheDocument()
    })

    it('bấm "Quay lại" không gọi RPC', async () => {
      api.fetchOrderDetail.mockResolvedValue(makeOrder())
      renderDetail()

      await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận đơn' }))
      const dialog = await screen.findByRole('dialog', { name: 'Xác nhận đơn hàng?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(api.transitionOrder).not.toHaveBeenCalled()
    })
  })

  it('hủy đơn đã xác nhận: hộp thoại báo hoàn kho', async () => {
    api.fetchOrderDetail.mockResolvedValue(makeOrder({ status: 'confirmed' }))
    api.transitionOrder.mockResolvedValue()
    renderDetail()

    await userEvent.click(await screen.findByRole('button', { name: 'Hủy đơn' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hủy đơn hàng?' })
    expect(dialog).toHaveTextContent('hoàn lại kho')
    expect(dialog).toHaveTextContent('Quần jean: +1')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }))
    await waitFor(() =>
      expect(api.transitionOrder).toHaveBeenCalledWith(ORDER_ID, 'confirmed', 'cancelled'),
    )
  })

  it('đơn đã xác nhận: hiện giá vốn hàng bán và lợi nhuận gộp theo giá vốn đã chốt', async () => {
    const order = makeOrder({ status: 'confirmed' })
    api.fetchOrderDetail.mockResolvedValue({
      ...order,
      items: order.items.map((item) => ({ ...item, unit_cost: 90_000 })),
    })
    renderDetail()

    // Giá vốn: (2 + 1) × 90.000 = 270.000; lợi nhuận 450.000 − 270.000 = 180.000 (40%)
    const cogs = await screen.findByText('Giá vốn hàng bán')
    expect(cogs.parentElement).toHaveTextContent(/270\.000\s₫/)
    expect(screen.getByText('Lợi nhuận gộp').parentElement).toHaveTextContent(/180\.000\s₫ · 40%/)
  })

  it('đơn chờ xác nhận chưa có lợi nhuận (chưa chốt giá vốn)', async () => {
    api.fetchOrderDetail.mockResolvedValue(makeOrder())
    renderDetail()
    expect(
      await screen.findByText('Lợi nhuận gộp được tính khi đơn được xác nhận (chốt giá vốn).'),
    ).toBeInTheDocument()
  })

  it('giao hàng không cần hộp thoại xác nhận', async () => {
    api.fetchOrderDetail.mockResolvedValue(makeOrder({ status: 'confirmed' }))
    api.transitionOrder.mockResolvedValue()
    renderDetail()

    await userEvent.click(await screen.findByRole('button', { name: 'Giao hàng' }))
    await waitFor(() =>
      expect(api.transitionOrder).toHaveBeenCalledWith(ORDER_ID, 'confirmed', 'shipping'),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
