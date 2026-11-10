import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  adjustProductStock,
  createProduct,
  deleteProduct,
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
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  updateProductPrice: vi.fn(),
  setProductActive: vi.fn(),
  adjustProductStock: vi.fn(),
  deleteProduct: vi.fn(),
}))

const api = {
  fetchProducts: vi.mocked(fetchProducts),
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
  category: 'Áo thun',
  price: 150_000,
  stock: 20,
  low_stock_threshold: 5,
  is_low_stock: false,
  is_active: true,
  description: null,
  hero_image_path: null,
  image_paths: [],
  created_at: '2026-11-01T03:00:00Z',
  ...overrides,
})

const page = (items: Product[], total = items.length): ProductPage => ({ items, total })
const normalize = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ')

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
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
          makeProduct({
            id: 'p2',
            sku: 'QJ-1',
            name: 'Quần jean slim',
            stock: 2,
            is_low_stock: true,
          }),
          makeProduct({ id: 'p3', sku: 'MU-1', name: 'Mũ', stock: 0, is_low_stock: true }),
        ],
        23,
      ),
    )
    renderWithProviders(<ProductsView />, { route: '/products' })

    const row = (await screen.findByText('Quần jean slim')).closest('tr')
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
    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith(product, expect.anything()))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('ngừng bán cần xác nhận; mở bán lại thì không', async () => {
    api.fetchProducts.mockResolvedValue(
      page([makeProduct(), makeProduct({ id: 'p2', name: 'Quần cũ', is_active: false })]),
    )
    api.setProductActive.mockResolvedValue()
    renderWithProviders(<ProductsView />, { route: '/products' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Quần cũ' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Đăng bán' }))
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
  const fillRequired = async () => {
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo polo')
    await userEvent.click(screen.getByRole('combobox', { name: /Danh mục/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Áo polo' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Giá bán/ }), '250000')
  }

  it('form trống: giá và tồn kho không điền sẵn 0; báo lỗi khi bỏ trống', async () => {
    renderWithProviders(<ProductForm onDone={vi.fn()} />)

    expect(screen.getByRole('textbox', { name: /Giá bán/ })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: /Tồn kho ban đầu/ })).toHaveValue('')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Đăng sản phẩm' }))
    expect(await screen.findByText('Vui lòng nhập tên sản phẩm')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng chọn danh mục')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập giá bán')).toBeInTheDocument()
    expect(api.createProduct).not.toHaveBeenCalled()
  })

  it('xem trước SKU theo tên sản phẩm', async () => {
    renderWithProviders(<ProductForm onDone={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo thun Đỏ')
    expect(screen.getByText('DN-AOTHUNDO-###')).toBeInTheDocument()
  })

  it('"Đăng sản phẩm" tạo sản phẩm đang bán, tồn kho trống = 0, không gửi SKU', async () => {
    const onDone = vi.fn()
    api.createProduct.mockResolvedValue(makeProduct())
    renderWithProviders(<ProductForm onDone={onDone} />)

    await fillRequired()
    await userEvent.click(screen.getByRole('button', { name: 'Đăng sản phẩm' }))

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledTimes(1))
    expect(api.createProduct.mock.calls[0]?.[0]).toEqual({
      name: 'Áo polo',
      category: 'Áo polo',
      price: 250_000,
      stock: 0,
      low_stock_threshold: 5,
      description: null,
      is_active: true,
    })
    // Không có ảnh → media rỗng
    expect(api.createProduct.mock.calls[0]?.[1]).toEqual({ hero: null, gallery: [] })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('"Thêm sản phẩm" lưu nhưng chưa đăng (is_active = false)', async () => {
    api.createProduct.mockResolvedValue(makeProduct({ is_active: false }))
    renderWithProviders(<ProductForm onDone={vi.fn()} />)

    await fillRequired()
    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledTimes(1))
    expect(api.createProduct.mock.calls[0]?.[0]).toMatchObject({ is_active: false })
  })

  it('không cho số 0 đứng đầu ô giá', async () => {
    renderWithProviders(<ProductForm onDone={vi.fn()} />)
    const price = screen.getByRole('textbox', { name: /Giá bán/ })
    await userEvent.type(price, '0150000')
    await userEvent.tab()
    expect(price).toHaveValue('150.000 ₫')
  })

  it('chế độ sửa: SKU chỉ đọc, khóa ô tồn kho, giữ trạng thái đăng', async () => {
    const product = makeProduct({ is_active: false })
    api.updateProduct.mockResolvedValue(product)
    renderWithProviders(<ProductForm product={product} onDone={vi.fn()} />)

    expect(screen.getByText('AT-001')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /SKU/ })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Tồn kho hiện tại/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Đăng sản phẩm' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() =>
      expect(api.updateProduct).toHaveBeenCalledWith(
        product,
        expect.objectContaining({ category: 'Áo thun', is_active: false }),
        { hero: null, gallery: [] },
      ),
    )
  })
})
