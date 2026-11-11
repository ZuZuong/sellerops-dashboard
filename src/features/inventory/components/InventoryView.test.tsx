import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CsvModule from '@/shared/lib/csv'
import { downloadCsv } from '@/shared/lib/csv'
import { renderWithProviders } from '@/test/render'
import {
  adjustStock,
  fetchInventory,
  fetchInventoryForExport,
  fetchInventorySummary,
  fetchStockMovements,
} from '../api/inventory.api'
import type { InventoryItem, InventoryPage, InventorySummary } from '../types'
import { InventoryView } from './InventoryView'

vi.mock('../api/inventory.api', () => ({
  EXPORT_LIMIT: 5000,
  fetchInventory: vi.fn(),
  fetchInventoryForExport: vi.fn(),
  fetchInventorySummary: vi.fn(),
  fetchStockMovements: vi.fn(),
  adjustStock: vi.fn(),
}))

vi.mock('@/shared/lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof CsvModule>()),
  downloadCsv: vi.fn(),
}))

const api = {
  fetchInventory: vi.mocked(fetchInventory),
  fetchInventoryForExport: vi.mocked(fetchInventoryForExport),
  fetchInventorySummary: vi.mocked(fetchInventorySummary),
  fetchStockMovements: vi.mocked(fetchStockMovements),
  adjustStock: vi.mocked(adjustStock),
}
const download = vi.mocked(downloadCsv)

const makeItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'p1',
  sku: 'DN-AOTHUN-001',
  name: 'Áo thun basic',
  category: 'Áo thun',
  price: 150_000,
  stock: 3,
  low_stock_threshold: 5,
  is_low_stock: true,
  is_active: true,
  ...overrides,
})

const SUMMARY: InventorySummary = {
  product_count: 12,
  low_stock_count: 2,
  out_of_stock_count: 1,
  total_units: 340,
  stock_value: 51_000_000,
}

const page = (items: InventoryItem[], total = items.length): InventoryPage => ({ items, total })

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  download.mockReset()
  api.fetchInventorySummary.mockResolvedValue(SUMMARY)
})

describe('InventoryView', () => {
  it('hiện skeleton khi đang tải', () => {
    api.fetchInventory.mockReturnValue(new Promise(() => {}))
    api.fetchInventorySummary.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<InventoryView />, { route: '/inventory' })
    expect(screen.getAllByTestId('inventory-row-skeleton').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('inventory-summary-skeleton')).toHaveLength(4)
  })

  it('hiện tổng quan kho, badge cảnh báo và giá trị tồn', async () => {
    api.fetchInventory.mockResolvedValue(
      page([makeItem(), makeItem({ id: 'p2', name: 'Quần jean', stock: 0 })]),
    )
    renderWithProviders(<InventoryView />, { route: '/inventory' })

    const row = (await screen.findByText('Áo thun basic')).closest('tr')
    expect(row).toHaveTextContent('Sắp hết')
    expect(row).toHaveTextContent(/450\.000\s₫/)
    expect(screen.getByText('Quần jean').closest('tr')).toHaveTextContent('Hết hàng')
    expect(await screen.findByText(/51\.000\.000\s₫/)).toBeInTheDocument()
  })

  it('mặc định: đang bán, tồn kho thấp nhất trước; lọc qua thẻ tổng quan ghi lên URL', async () => {
    api.fetchInventory.mockResolvedValue(page([makeItem()]))
    renderWithProviders(<InventoryView />, { route: '/inventory' })
    await screen.findByText('Áo thun basic')
    expect(api.fetchInventory).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', level: 'all', sort: 'stock', order: 'asc' }),
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Lọc sản phẩm hết hàng' }))
    await waitFor(() =>
      expect(api.fetchInventory).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: 'out', page: 1 }),
      ),
    )
  })

  it('empty state khi lọc không ra kết quả; error state có nút thử lại', async () => {
    api.fetchInventory.mockResolvedValue(page([]))
    const first = renderWithProviders(<InventoryView />, { route: '/inventory?level=out' })
    expect(await screen.findByText('Không có sản phẩm phù hợp')).toBeInTheDocument()
    first.unmount()

    api.fetchInventory.mockReset()
    api.fetchInventory.mockRejectedValueOnce(new Error('boom'))
    api.fetchInventory.mockResolvedValueOnce(page([makeItem()]))
    renderWithProviders(<InventoryView />, { route: '/inventory' })
    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Áo thun basic')).toBeInTheDocument()
  })

  describe('điều chỉnh kho', () => {
    const openAdjust = async () => {
      await userEvent.click(
        await screen.findByRole('button', { name: 'Điều chỉnh kho Áo thun basic' }),
      )
      return screen.findByRole('dialog', { name: 'Điều chỉnh tồn kho' })
    }

    it('nhập hàng: xem trước tồn kho mới, gửi delta dương kèm ghi chú', async () => {
      api.fetchInventory.mockResolvedValue(page([makeItem()]))
      api.adjustStock.mockResolvedValue(13)
      renderWithProviders(<InventoryView />, { route: '/inventory' })

      const dialog = await openAdjust()
      await userEvent.type(within(dialog).getByRole('textbox', { name: /Số lượng nhập/ }), '10')
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Ghi chú' }), 'Lô 11/2026')
      expect(within(dialog).getByTestId('stock-preview')).toHaveTextContent('3 → 13')

      await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu điều chỉnh' }))
      await waitFor(() =>
        expect(api.adjustStock).toHaveBeenCalledWith('p1', 10, 'Nhập hàng: Lô 11/2026'),
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('kiểm kê: gửi chênh lệch so với tồn hiện tại', async () => {
      api.fetchInventory.mockResolvedValue(page([makeItem()]))
      api.adjustStock.mockResolvedValue(1)
      renderWithProviders(<InventoryView />, { route: '/inventory' })

      const dialog = await openAdjust()
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Kiểm kê' }))
      await userEvent.type(within(dialog).getByRole('textbox', { name: /Tồn kho thực tế/ }), '1')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu điều chỉnh' }))

      await waitFor(() => expect(api.adjustStock).toHaveBeenCalledWith('p1', -2, 'Kiểm kê'))
    })

    it('xuất quá tồn kho bị chặn ở client, không gọi RPC', async () => {
      api.fetchInventory.mockResolvedValue(page([makeItem()]))
      renderWithProviders(<InventoryView />, { route: '/inventory' })

      const dialog = await openAdjust()
      await userEvent.click(within(dialog).getByRole('radio', { name: 'Xuất hủy' }))
      await userEvent.type(within(dialog).getByRole('textbox', { name: /Số lượng xuất/ }), '5')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu điều chỉnh' }))

      expect(
        await within(dialog).findByText('Không thể xuất quá tồn kho hiện tại (3)'),
      ).toBeInTheDocument()
      expect(api.adjustStock).not.toHaveBeenCalled()
    })
  })

  it('lịch sử biến động: lý do, mã đơn liên kết, dấu +/−', async () => {
    api.fetchInventory.mockResolvedValue(page([makeItem()]))
    api.fetchStockMovements.mockResolvedValue({
      items: [
        {
          id: 'm2',
          delta: -2,
          reason: 'order_confirmed',
          note: null,
          created_at: '2026-11-10T03:00:00Z',
          order: { id: 'o1', code: 'DH-000007' },
        },
        {
          id: 'm1',
          delta: 5,
          reason: 'manual_adjust',
          note: 'Nhập hàng: Lô đầu',
          created_at: '2026-11-01T03:00:00Z',
          order: null,
        },
      ],
      total: 2,
    })
    renderWithProviders(<InventoryView />, { route: '/inventory' })

    await userEvent.click(await screen.findByRole('button', { name: 'Lịch sử kho Áo thun basic' }))
    const drawer = await screen.findByRole('dialog', { name: 'Lịch sử biến động kho' })
    expect(await within(drawer).findByRole('link', { name: 'DH-000007' })).toHaveAttribute(
      'href',
      '/orders/o1',
    )
    expect(within(drawer).getByText('Xác nhận đơn').closest('tr')).toHaveTextContent('−2')
    expect(within(drawer).getByText('Nhập hàng: Lô đầu').closest('tr')).toHaveTextContent('+5')
    expect(api.fetchStockMovements).toHaveBeenCalledWith('p1', 1, 10)
  })

  it('xuất CSV theo bộ lọc hiện tại', async () => {
    const items = [makeItem()]
    api.fetchInventory.mockResolvedValue(page(items))
    api.fetchInventoryForExport.mockResolvedValue(items)
    renderWithProviders(<InventoryView />, { route: '/inventory?level=low' })

    await userEvent.click(await screen.findByRole('button', { name: 'Xuất CSV' }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(api.fetchInventoryForExport).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'low' }),
    )
    const [filename, csv] = download.mock.calls[0] ?? []
    expect(filename).toMatch(/^ton-kho-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv).toContain('DN-AOTHUN-001,Áo thun basic')
  })
})
