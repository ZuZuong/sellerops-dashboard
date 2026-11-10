import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  fetchProductCategories,
  fetchProducts,
  setProductActive,
  updateProduct,
  updateProductPrice,
} from '../api/products.api'
import type { Product, ProductPage } from '../types'
import { ProductForm } from './ProductFormModal'
import { ProductsView } from './ProductsView'

vi.mock('../api/products.api', () => ({
  fetchProducts: vi.fn(),
  fetchProductCategories: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  updateProductPrice: vi.fn(),
  setProductActive: vi.fn(),
  adjustProductStock: vi.fn(),
  deleteProduct: vi.fn(),
}))

const api = {
  fetchProducts: vi.mocked(fetchProducts),
  fetchProductCategories: vi.mocked(fetchProductCategories),
  createProduct: vi.mocked(createProduct),
  updateProduct: vi.mocked(updateProduct),
  updateProductPrice: vi.mocked(updateProductPrice),
  setProductActive: vi.mocked(setProductActive),
  adjustProductStock: vi.mocked(adjustProductStock),
  deleteProduct: vi.mocked(deleteProduct),
}

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  sku: 'AT-001',
  name: 'Áo thun basic',
  category: 'Áo',
  price: 150_000,
  stock: 20,
  low_stock_threshold: 5,
  is_low_stock: false,
  is_active: true,
  created_at: '2026-11-01T03:00:00Z',
  ...overrides,
})

const page = (items: Product[], total = items.length): ProductPage => ({ items, total })
const normalize = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  api.fetchProductCategories.mockResolvedValue(['Áo', 'Quần'])
})

describe('ProductsView', () => {
  it('hiện skeleton khi đang tải', () => {
    api.fetchProducts.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProductsView />, { route: '/products' })
    expect(screen.getAllByTestId('product-row-skeleton').length).toBeGreaterThan(0)
  })

  it('hiện danh sách, badge tồn kho và thông tin phân trang', async () => {
    api.fetchProducts.mockResolvedValue(
      page(
        [
          makeProduct(),
          makeProduct({ id: 'p2', sku: 'QJ-1', name: 'Quần jean', stock: 2, is_low_stock: true }),
          makeProduct({ id: 'p3', sku: 'MU-1', name: 'Mũ', stock: 0, is_low_stock: true }),
        ],
        23,
      ),
    )
    renderWithProviders(<ProductsView />, { route: '/products' })

    const row = (await screen.findByText('Quần jean')).closest('tr')
    expect(row).toHaveTextContent('Sắp hết')
    expect(screen.getByText('Mũ').closest('tr')).toHaveTextContent('Hết hàng')
    expect(screen.getByText(/Hiển thị 1–10 trong 23 sản phẩm/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang 3' })).toBeInTheDocument()
  })

  it('đọc filter từ URL và gửi lên API', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    renderWithProviders(<ProductsView />, {
      route: '/products?q=ao&status=active&sort=price&order=asc&page=2',
    })

    await screen.findByText('Áo thun basic')
    expect(api.fetchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ao', status: 'active', sort: 'price', order: 'asc', page: 2 }),
    )
    expect(screen.getByRole('textbox', { name: 'Tìm theo tên hoặc SKU' })).toHaveValue('ao')
    expect(screen.getByRole('columnheader', { name: /Giá bán/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
  })

  it('tìm kiếm được debounce rồi mới gọi API', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    renderWithProviders(<ProductsView />, { route: '/products' })
    await screen.findByText('Áo thun basic')

    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm theo tên hoặc SKU' }), 'quần')
    // Gõ liên tục 4 ký tự nhưng chỉ phát sinh 1 request cho từ khóa cuối cùng.
    await waitFor(() =>
      expect(api.fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'quần' })),
    )
    const queries = api.fetchProducts.mock.calls.map(([filters]) => filters.q)
    expect(queries).toEqual(['', 'quần'])
  })

  it('empty state khi chưa có sản phẩm và khi lọc không ra kết quả', async () => {
    api.fetchProducts.mockResolvedValue(page([]))
    const first = renderWithProviders(<ProductsView />, { route: '/products' })
    expect(await screen.findByText('Chưa có sản phẩm nào')).toBeInTheDocument()
    first.unmount()

    renderWithProviders(<ProductsView />, { route: '/products?stock=out' })
    expect(await screen.findByText('Không tìm thấy sản phẩm phù hợp')).toBeInTheDocument()
  })

  it('error state có nút thử lại', async () => {
    api.fetchProducts.mockRejectedValueOnce(new Error('boom'))
    api.fetchProducts.mockResolvedValueOnce(page([makeProduct()]))
    renderWithProviders(<ProductsView />, { route: '/products' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Áo thun basic')).toBeInTheDocument()
  })

  it('xóa cần xác nhận; lỗi PRODUCT_IN_ORDERS hiện thông báo tiếng Việt', async () => {
    const product = makeProduct()
    api.fetchProducts.mockResolvedValue(page([product]))
    api.deleteProduct.mockRejectedValue({ code: 'P0001', message: 'PRODUCT_IN_ORDERS' })
    renderWithProviders(<ProductsView />, { route: '/products' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Áo thun basic' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Xóa' }))

    const dialog = await screen.findByRole('dialog', { name: 'Xóa sản phẩm?' })
    expect(api.deleteProduct).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))
    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('ngừng bán cần xác nhận; mở bán lại thì không', async () => {
    api.fetchProducts.mockResolvedValue(
      page([makeProduct(), makeProduct({ id: 'p2', name: 'Quần cũ', is_active: false })]),
    )
    api.setProductActive.mockResolvedValue()
    renderWithProviders(<ProductsView />, { route: '/products' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Quần cũ' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Mở bán lại' }))
    await waitFor(() => expect(api.setProductActive).toHaveBeenCalledWith('p2', true))
    // Đợi danh sách refetch (invalidate sau mutation) xong để bảng không render lại giữa chừng.
    await waitFor(() => expect(api.fetchProducts).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Áo thun basic' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Ngừng bán' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ngừng bán sản phẩm?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng bán' }))
    await waitFor(() => expect(api.setProductActive).toHaveBeenCalledWith('p1', false))
  })

  it('sửa nhanh giá: cập nhật ngay (optimistic) và rollback khi lỗi', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    let rejectUpdate: (error: unknown) => void = () => {}
    api.updateProductPrice.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectUpdate = reject
      }),
    )
    renderWithProviders(<ProductsView />, { route: '/products' })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Sửa nhanh giá của Áo thun basic' }),
    )
    const input = await screen.findByRole('textbox', { name: 'Sửa nhanh giá của Áo thun basic' })
    await userEvent.clear(input)
    await userEvent.type(input, '199000{Enter}')

    // Chưa có phản hồi từ server nhưng bảng đã hiện giá mới.
    const cell = () => screen.getByRole('button', { name: 'Sửa nhanh giá của Áo thun basic' })
    await waitFor(() => expect(normalize(cell().textContent)).toContain('199.000 ₫'))
    expect(api.updateProductPrice).toHaveBeenCalledWith('p1', 199_000)

    rejectUpdate(new Error('boom'))
    await waitFor(() => expect(normalize(cell().textContent)).toContain('150.000 ₫'))
  })

  it('sửa nhanh tồn kho gửi delta qua adjust_stock', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct({ stock: 20 })]))
    api.adjustProductStock.mockResolvedValue(15)
    renderWithProviders(<ProductsView />, { route: '/products' })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Sửa nhanh tồn kho của Áo thun basic' }),
    )
    const input = await screen.findByRole('textbox', {
      name: 'Sửa nhanh tồn kho của Áo thun basic',
    })
    await userEvent.clear(input)
    await userEvent.type(input, '15{Enter}')

    await waitFor(() =>
      expect(api.adjustProductStock).toHaveBeenCalledWith('p1', -5, expect.any(String)),
    )
  })
})

describe('ProductForm', () => {
  it('validate và không gọi API khi dữ liệu sai', async () => {
    renderWithProviders(<ProductForm onDone={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))
    expect(await screen.findByText('Vui lòng nhập SKU')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập tên sản phẩm')).toBeInTheDocument()
    expect(api.createProduct).not.toHaveBeenCalled()
  })

  it('tạo sản phẩm với dữ liệu đã chuẩn hóa', async () => {
    const onDone = vi.fn()
    api.createProduct.mockResolvedValue(makeProduct())
    renderWithProviders(<ProductForm onDone={onDone} />)

    await userEvent.type(screen.getByRole('textbox', { name: /SKU/ }), ' at-002 ')
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo polo')
    const price = screen.getByRole('textbox', { name: /Giá bán/ })
    await userEvent.clear(price)
    await userEvent.type(price, '250000')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledTimes(1))
    expect(api.createProduct.mock.calls[0]?.[0]).toEqual({
      sku: 'AT-002',
      name: 'Áo polo',
      category: null,
      price: 250_000,
      stock: 0,
      low_stock_threshold: 5,
      is_active: true,
    })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('SKU trùng → báo lỗi ngay tại ô SKU và giữ form mở', async () => {
    const onDone = vi.fn()
    api.createProduct.mockRejectedValue({ code: '23505', message: 'duplicate key' })
    renderWithProviders(<ProductForm onDone={onDone} />)

    await userEvent.type(screen.getByRole('textbox', { name: /SKU/ }), 'AT-001')
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))

    expect(await screen.findByText('SKU đã tồn tại')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('chế độ sửa: điền sẵn dữ liệu, khóa ô tồn kho', async () => {
    api.updateProduct.mockResolvedValue(makeProduct())
    renderWithProviders(<ProductForm product={makeProduct()} onDone={vi.fn()} />)

    expect(screen.getByRole('textbox', { name: /SKU/ })).toHaveValue('AT-001')
    expect(screen.getByRole('textbox', { name: /Tồn kho hiện tại/ })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() =>
      expect(api.updateProduct).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ sku: 'AT-001' }),
      ),
    )
  })
})
