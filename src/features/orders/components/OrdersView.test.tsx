import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  createOrder,
  fetchOrders,
  searchOrderableProducts,
  transitionOrder,
} from '../api/orders.api'
import type { Order, OrderableProduct, OrderPage } from '../types'
import { CreateOrderForm } from './CreateOrderModal'
import { OrdersView } from './OrdersView'

vi.mock('../api/orders.api', () => ({
  fetchOrders: vi.fn(),
  fetchOrderDetail: vi.fn(),
  searchOrderableProducts: vi.fn(),
  createOrder: vi.fn(),
  transitionOrder: vi.fn(),
}))

const api = {
  fetchOrders: vi.mocked(fetchOrders),
  searchOrderableProducts: vi.mocked(searchOrderableProducts),
  createOrder: vi.mocked(createOrder),
  transitionOrder: vi.mocked(transitionOrder),
}

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'o1',
  code: 'DH-000001',
  customer_name: 'Nguyễn Văn A',
  customer_phone: '0901234567',
  status: 'pending',
  total: 300_000,
  created_at: '2026-11-10T02:00:00Z',
  ...overrides,
})

const page = (items: Order[], total = items.length): OrderPage => ({ items, total })

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})

describe('OrdersView', () => {
  it('hiện skeleton khi đang tải', () => {
    api.fetchOrders.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<OrdersView />, { route: '/orders' })
    expect(screen.getAllByTestId('order-row-skeleton').length).toBeGreaterThan(0)
  })

  it('hiện danh sách, link chi tiết và thông tin phân trang', async () => {
    api.fetchOrders.mockResolvedValue(
      page([makeOrder(), makeOrder({ id: 'o2', code: 'DH-000002', status: 'shipping' })], 25),
    )
    renderWithProviders(<OrdersView />, { route: '/orders' })

    const link = await screen.findByRole('link', { name: 'DH-000001' })
    expect(link).toHaveAttribute('href', '/orders/o1')
    expect(screen.getByRole('link', { name: 'DH-000002' }).closest('tr')).toHaveTextContent(
      'Đang giao',
    )
    expect(screen.getByText(/Hiển thị 1–10 trong 25 đơn hàng/)).toBeInTheDocument()
  })

  it('đọc trạng thái + từ khóa từ URL; đổi trạng thái gửi filter mới về trang 1', async () => {
    api.fetchOrders.mockResolvedValue(page([makeOrder()]))
    renderWithProviders(<OrdersView />, { route: '/orders?status=pending&q=DH&page=2' })

    await screen.findByRole('link', { name: 'DH-000001' })
    expect(api.fetchOrders).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', q: 'DH', page: 2 }),
    )
    expect(screen.getByRole('radio', { name: 'Chờ xác nhận' })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: 'Đã hủy' }))
    await waitFor(() =>
      expect(api.fetchOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'cancelled', page: 1 }),
      ),
    )
  })

  it('tìm kiếm được debounce rồi mới gọi API', async () => {
    api.fetchOrders.mockResolvedValue(page([makeOrder()]))
    renderWithProviders(<OrdersView />, { route: '/orders' })
    await screen.findByRole('link', { name: 'DH-000001' })

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Tìm theo mã đơn, tên hoặc SĐT khách' }),
      'lan',
    )
    await waitFor(() =>
      expect(api.fetchOrders).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'lan' })),
    )
    expect(api.fetchOrders.mock.calls.map(([filters]) => filters.q)).toEqual(['', 'lan'])
  })

  it('empty state khi chưa có đơn và khi lọc không ra kết quả', async () => {
    api.fetchOrders.mockResolvedValue(page([]))
    const first = renderWithProviders(<OrdersView />, { route: '/orders' })
    expect(await screen.findByText('Chưa có đơn hàng nào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo đơn hàng' })).toBeInTheDocument()
    first.unmount()

    renderWithProviders(<OrdersView />, { route: '/orders?status=delivered' })
    expect(await screen.findByText('Không tìm thấy đơn hàng phù hợp')).toBeInTheDocument()
  })

  it('error state có nút thử lại', async () => {
    api.fetchOrders.mockRejectedValueOnce(new Error('boom'))
    api.fetchOrders.mockResolvedValueOnce(page([makeOrder()]))
    renderWithProviders(<OrdersView />, { route: '/orders' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('link', { name: 'DH-000001' })).toBeInTheDocument()
  })

  it('menu dòng chỉ có thao tác hợp lệ; hủy từ danh sách cần xác nhận', async () => {
    api.fetchOrders.mockResolvedValue(
      page([makeOrder(), makeOrder({ id: 'o2', code: 'DH-000002', status: 'delivered' })]),
    )
    api.transitionOrder.mockResolvedValue()
    renderWithProviders(<OrdersView />, { route: '/orders' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho đơn DH-000002' }))
    const deliveredMenu = await screen.findByRole('menu')
    expect(
      within(deliveredMenu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Xem chi tiết'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho đơn DH-000001' }))
    const menu = await screen.findByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Xem chi tiết', 'Xác nhận đơn', 'Hủy đơn'])
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Hủy đơn' }))

    const dialog = await screen.findByRole('dialog', { name: 'Hủy đơn hàng?' })
    expect(dialog).toHaveTextContent('Kho không thay đổi')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy đơn' }))
    await waitFor(() =>
      expect(api.transitionOrder).toHaveBeenCalledWith('o1', 'pending', 'cancelled'),
    )
  })
})

describe('CreateOrderForm', () => {
  const products: OrderableProduct[] = [
    { id: 'p1', name: 'Áo thun basic', sku: 'DN-AOTHUNBASIC-001', price: 150_000, stock: 10 },
    { id: 'p2', name: 'Quần jean', sku: 'DN-QUANJEAN-002', price: 400_000, stock: 1 },
  ]

  const pickProduct = async (index: number, name: string) => {
    await userEvent.click(screen.getByRole('combobox', { name: new RegExp(`Sản phẩm ${index}`) }))
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }))
  }

  const quantity = (index: number) =>
    screen.getByRole('textbox', { name: `Số lượng sản phẩm ${index}` })

  beforeEach(() => {
    api.searchOrderableProducts.mockResolvedValue(products)
  })

  it('báo lỗi khi bỏ trống tên khách và chưa chọn sản phẩm', async () => {
    renderWithProviders(<CreateOrderForm onCancel={vi.fn()} onCreated={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))

    expect(await screen.findByText('Vui lòng nhập tên khách hàng')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng chọn sản phẩm')).toBeInTheDocument()
    expect(api.createOrder).not.toHaveBeenCalled()
  })

  it('tính tạm tổng tiền, cảnh báo vượt tồn kho và gửi payload chỉ gồm product_id + quantity', async () => {
    api.createOrder.mockResolvedValue('new-order-id')
    const onCreated = vi.fn()
    renderWithProviders(<CreateOrderForm onCancel={vi.fn()} onCreated={onCreated} />)

    await userEvent.type(screen.getByRole('textbox', { name: /Tên khách hàng/ }), 'Lê Văn C')
    await userEvent.type(screen.getByRole('textbox', { name: /Số điện thoại/ }), '0912 345 678')

    await pickProduct(1, 'Áo thun basic')
    await userEvent.clear(quantity(1))
    await userEvent.type(quantity(1), '3')

    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))
    await pickProduct(2, 'Quần jean')
    await userEvent.clear(quantity(2))
    await userEvent.type(quantity(2), '2')

    // 3 × 150.000 + 2 × 400.000
    expect(screen.getByTestId('order-total')).toHaveTextContent(/1\.250\.000\s₫/)
    expect(screen.getByText('Có sản phẩm vượt tồn kho')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }))
    await waitFor(() =>
      expect(api.createOrder).toHaveBeenCalledWith({
        customer_name: 'Lê Văn C',
        customer_phone: '0912345678',
        items: [
          { product_id: 'p1', quantity: 3 },
          { product_id: 'p2', quantity: 2 },
        ],
      }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-order-id'))
  })

  it('sản phẩm đã chọn không xuất hiện lại ở dòng khác', async () => {
    renderWithProviders(<CreateOrderForm onCancel={vi.fn()} onCreated={vi.fn()} />)
    await pickProduct(1, 'Áo thun basic')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))

    await userEvent.click(screen.getByRole('combobox', { name: /Sản phẩm 2/ }))
    await screen.findByRole('option', { name: /Quần jean/ })
    expect(screen.queryByRole('option', { name: /Áo thun basic/ })).not.toBeInTheDocument()
  })
})
