import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  fetchImportedProducts,
  fetchProductImports,
  getImportFileUrl,
} from '../api/productImports.api'
import { fetchProductInsight } from '../api/products.api'
import type { Product, ProductImport } from '../types'
import { ProductImportHistory } from './ProductImportHistory'
import { ProductInsightDrawer } from './ProductInsightDrawer'

vi.mock('../api/productImports.api', () => ({
  fetchProductImports: vi.fn(),
  fetchImportedProducts: vi.fn(),
  getImportFileUrl: vi.fn(),
  importProductsFromFile: vi.fn(),
}))

vi.mock('../api/products.api', () => ({
  fetchProductInsight: vi.fn(),
}))

const api = {
  fetchProductImports: vi.mocked(fetchProductImports),
  fetchImportedProducts: vi.mocked(fetchImportedProducts),
  getImportFileUrl: vi.mocked(getImportFileUrl),
  fetchProductInsight: vi.mocked(fetchProductInsight),
}

const IMPORT: ProductImport = {
  id: 'imp-1',
  file_name: 'hang-ve-thang-11.xlsx',
  file_path: 'user-1/abc.xlsx',
  file_size: 24_576,
  sheet_name: 'Sản phẩm',
  row_count: 2,
  imported_count: 2,
  published: true,
  created_at: '2026-11-10T03:00:00Z',
}

const assign = vi.fn()

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  assign.mockReset()
  vi.stubGlobal('location', { ...window.location, assign })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProductImportHistory', () => {
  it('hiện thông tin file gốc và kết quả mỗi lần nhập', async () => {
    api.fetchProductImports.mockResolvedValue({ items: [IMPORT], total: 1 })
    renderWithProviders(<ProductImportHistory />)

    const row = (await screen.findByText('hang-ve-thang-11.xlsx')).closest('tr')
    expect(row).toHaveTextContent('24 KB · sheet "Sản phẩm"')
    expect(row).toHaveTextContent('Đăng bán ngay')
    expect(row).toHaveTextContent('Thành công')
    expect(api.fetchProductImports).toHaveBeenCalledWith(1, 10)
  })

  it('tải file gốc qua signed URL', async () => {
    api.fetchProductImports.mockResolvedValue({ items: [IMPORT], total: 1 })
    api.getImportFileUrl.mockResolvedValue('https://signed.example/file')
    renderWithProviders(<ProductImportHistory />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Tải file hang-ve-thang-11.xlsx' }),
    )
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://signed.example/file'))
    expect(api.getImportFileUrl).toHaveBeenCalledWith(IMPORT)
  })

  it('xem danh sách sản phẩm tạo từ lần nhập', async () => {
    api.fetchProductImports.mockResolvedValue({ items: [IMPORT], total: 1 })
    api.fetchImportedProducts.mockResolvedValue([
      {
        id: 'p1',
        sku: 'DN-AOTHUN-001',
        name: 'Áo thun',
        category: 'Áo thun',
        unit: 'Cái',
        cost_price: 90_000,
        price: 150_000,
        stock: 20,
        is_active: true,
      },
    ])
    renderWithProviders(<ProductImportHistory />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Xem sản phẩm từ hang-ve-thang-11.xlsx' }),
    )
    const drawer = await screen.findByRole('dialog', { name: 'Sản phẩm từ lần nhập' })
    const row = (await within(drawer).findByText('Áo thun')).closest('tr')
    expect(row).toHaveTextContent(/90\.000\s₫/)
    expect(row).toHaveTextContent('20 Cái')
    expect(api.fetchImportedProducts).toHaveBeenCalledWith('imp-1')
  })

  it('chưa có lần nhập nào → empty state', async () => {
    api.fetchProductImports.mockResolvedValue({ items: [], total: 0 })
    renderWithProviders(<ProductImportHistory />)
    expect(await screen.findByText('Chưa có lần nhập nào')).toBeInTheDocument()
  })
})

describe('ProductInsightDrawer', () => {
  const product: Product = {
    id: 'p1',
    sku: 'DN-AOTHUN-001',
    name: 'Áo thun basic',
    category: 'Áo thun',
    unit: 'Cái',
    cost_price: 99_642.86,
    price: 150_000,
    stock: 28,
    low_stock_threshold: 5,
    is_low_stock: false,
    is_active: true,
    description: null,
    hero_image_path: null,
    image_paths: [],
    created_at: '2026-11-01T03:00:00Z',
  }

  it('giá vốn bình quân, lãi / SP, bán ra và nhập hàng', async () => {
    api.fetchProductInsight.mockResolvedValue({
      qty_sold: 12,
      revenue: 1_800_000,
      cogs: 1_150_000,
      gross_profit: 650_000,
      qty_received: 18,
      qty_defective: 1,
      receipt_count: 1,
      last_receipt_date: '2026-11-10',
      last_receipt_cost: 105_000,
    })
    renderWithProviders(<ProductInsightDrawer product={product} onClose={vi.fn()} />)

    const drawer = await screen.findByRole('dialog', { name: 'Hiệu quả sản phẩm' })
    // Lãi / SP = 150.000 − 99.642,86 ≈ 50.357 (biên 33,6%)
    expect(within(drawer).getByText('Lãi gộp / sản phẩm').parentElement).toHaveTextContent(
      /50\.357\s₫Biên 33,6%/,
    )
    expect(await within(drawer).findByText('Lợi nhuận gộp')).toBeInTheDocument()
    expect(within(drawer).getByText('Lợi nhuận gộp').parentElement).toHaveTextContent(
      /650\.000\s₫Biên 36,1%/,
    )
    expect(within(drawer).getByText('Hàng lỗi / không đạt').parentElement).toHaveTextContent(
      '1 Cái',
    )
    expect(within(drawer).getByText('Lần nhập gần nhất').parentElement).toHaveTextContent(
      /10\/11\/2026Đơn giá nhập 105\.000\s₫/,
    )
  })
})
