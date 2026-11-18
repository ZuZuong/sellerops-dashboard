import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as XlsxModule from '@/shared/lib/xlsxExport'
import { downloadXlsx } from '@/shared/lib/xlsxExport'
import { renderWithProviders } from '@/test/render'
import { fetchStocktakeItems } from '../api/inventory.api'
import type { InventoryItem } from '../types'
import { StocktakeView } from './StocktakeView'

vi.mock('../api/inventory.api', () => ({
  EXPORT_LIMIT: 5000,
  fetchStocktakeItems: vi.fn(),
}))

vi.mock('@/features/products/api/productCategories.api', () => ({
  fetchProductCategories: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@/shared/lib/xlsxExport', async (importOriginal) => ({
  ...(await importOriginal<typeof XlsxModule>()),
  downloadXlsx: vi.fn(() => Promise.resolve()),
}))

const fetchItems = vi.mocked(fetchStocktakeItems)

const makeItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'p1',
  sku: 'DN-AOTHUN-001',
  name: 'Áo thun basic',
  category: 'Áo thun',
  unit: 'Cái',
  cost_price: 90_000,
  price: 150_000,
  stock: 3,
  low_stock_threshold: 5,
  is_low_stock: true,
  is_active: true,
  ...overrides,
})

beforeEach(() => {
  fetchItems.mockReset()
  vi.mocked(downloadXlsx).mockClear()
})

describe('StocktakeView', () => {
  it('hiện skeleton khi đang tải', () => {
    fetchItems.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<StocktakeView />, { route: '/inventory/stocktake' })
    expect(screen.getByTestId('stocktake-skeleton')).toBeInTheDocument()
  })

  it('hiện biên bản Mẫu 05-VT với số liệu sổ sách; mặc định kiểm kê tất cả sản phẩm', async () => {
    fetchItems.mockResolvedValue({
      items: [makeItem(), makeItem({ id: 'p2', name: 'Đầm maxi', category: 'Đầm', stock: 0 })],
      truncated: false,
    })
    renderWithProviders(<StocktakeView />, { route: '/inventory/stocktake' })

    expect(
      await screen.findByRole('heading', {
        name: 'BIÊN BẢN KIỂM KÊ VẬT TƯ, CÔNG CỤ, SẢN PHẨM, HÀNG HÓA',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Mẫu số 05-VT')).toBeInTheDocument()
    expect(screen.getByText('Áo thun basic').closest('tr')).toHaveTextContent(/270\.000/)
    expect(screen.getByText('Đầm maxi')).toBeInTheDocument()
    expect(fetchItems).toHaveBeenCalledWith({ status: 'all', category: '' })
  })

  it('tải Excel gửi biên bản đã dựng', async () => {
    fetchItems.mockResolvedValue({ items: [makeItem()], truncated: false })
    renderWithProviders(<StocktakeView />, { route: '/inventory/stocktake' })

    await userEvent.click(await screen.findByRole('button', { name: 'Tải Excel' }))
    await waitFor(() => expect(downloadXlsx).toHaveBeenCalledTimes(1))
    const [filename, sheets] = vi.mocked(downloadXlsx).mock.calls[0] ?? []
    expect(filename).toMatch(/^bien-ban-kiem-ke-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(sheets?.[0]?.name).toBe('Kiểm kê')
  })

  it('empty state khi phạm vi không có sản phẩm; nút in bị vô hiệu', async () => {
    fetchItems.mockResolvedValue({ items: [], truncated: false })
    renderWithProviders(<StocktakeView />, { route: '/inventory/stocktake?status=active' })

    expect(await screen.findByText('Không có sản phẩm để kiểm kê')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'In / Lưu PDF' })).toBeDisabled()
  })

  it('error state có nút thử lại', async () => {
    fetchItems.mockRejectedValueOnce(new Error('boom'))
    fetchItems.mockResolvedValueOnce({ items: [makeItem()], truncated: false })
    renderWithProviders(<StocktakeView />, { route: '/inventory/stocktake' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Áo thun basic')).toBeInTheDocument()
  })
})
