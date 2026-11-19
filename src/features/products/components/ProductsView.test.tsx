import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Notifications, notifications } from '@mantine/notifications'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { categoryIdOf, testCategoryOverview } from '../test/fixtures'
import { renderWithProviders, TEST_SELLER_ID } from '@/test/render'
import {
  createProduct,
  fetchProducts,
  setProductActive,
  updateProduct,
  updateProductCost,
  updateProductPrice,
} from '../api/products.api'
import { trashProducts } from '../api/productTrash.api'
import type { Product, ProductPage } from '../types'
import { ProductForm } from './ProductFormModal'
import { ProductsView } from './ProductsView'

vi.mock('../api/products.api', () => ({
  fetchProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  updateProductPrice: vi.fn(),
  updateProductCost: vi.fn(),
  setProductActive: vi.fn(),
}))

vi.mock('@/features/categories/api/categories.api', () => ({
  fetchCategories: vi.fn(() => Promise.resolve(testCategoryOverview())),
}))

vi.mock('../api/productTrash.api', () => ({
  trashProducts: vi.fn(),
}))

const api = {
  fetchProducts: vi.mocked(fetchProducts),
  createProduct: vi.mocked(createProduct),
  updateProduct: vi.mocked(updateProduct),
  updateProductPrice: vi.mocked(updateProductPrice),
  updateProductCost: vi.mocked(updateProductCost),
  setProductActive: vi.mocked(setProductActive),
  trashProducts: vi.mocked(trashProducts),
}

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  sku: 'AT-001',
  name: 'Áo thun basic',
  category_id: categoryIdOf('Áo thun'),
  category: 'Áo thun',
  unit: 'Cái',
  cost_price: 90_000,
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
    renderWithProviders(<ProductsView />, { route: '/seller/products' })
    expect(screen.getAllByTestId('product-row-skeleton').length).toBeGreaterThan(0)
  })

  it('hiện danh sách, cột giá vốn (không có tồn kho) và thông tin phân trang', async () => {
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
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    const row = (await screen.findByText('Quần jean slim')).closest('tr')
    // Danh sách sản phẩm hiện giá vốn thay cho tồn kho (tồn kho xem ở trang Kho hàng).
    expect(screen.getByRole('columnheader', { name: /Giá vốn/ })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Tồn kho/ })).not.toBeInTheDocument()
    expect(row).not.toHaveTextContent('Sắp hết')
    expect(screen.getByText('Mũ').closest('tr')).not.toHaveTextContent('Hết hàng')
    expect(screen.getByText(/Hiển thị 1–10 trong 23 sản phẩm/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang 3' })).toBeInTheDocument()
  })

  it('đọc filter từ URL và gửi lên API', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    renderWithProviders(<ProductsView />, {
      route: '/seller/products?q=ao&status=active&sort=price&order=asc&page=2',
    })

    await screen.findByText('Áo thun basic')
    expect(api.fetchProducts).toHaveBeenCalledWith(
      TEST_SELLER_ID,
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
    renderWithProviders(<ProductsView />, { route: '/seller/products' })
    await screen.findByText('Áo thun basic')

    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm theo tên hoặc SKU' }), 'quần')
    // Gõ liên tục 4 ký tự nhưng chỉ phát sinh 1 request cho từ khóa cuối cùng.
    await waitFor(() =>
      expect(api.fetchProducts).toHaveBeenLastCalledWith(
        TEST_SELLER_ID,
        expect.objectContaining({ q: 'quần' }),
      ),
    )
    const queries = api.fetchProducts.mock.calls.map(([, filters]) => filters.q)
    expect(queries).toEqual(['', 'quần'])
  })

  it('empty state khi chưa có sản phẩm và khi lọc không ra kết quả', async () => {
    api.fetchProducts.mockResolvedValue(page([]))
    const first = renderWithProviders(<ProductsView />, { route: '/seller/products' })
    expect(await screen.findByText('Chưa có sản phẩm nào')).toBeInTheDocument()
    first.unmount()

    renderWithProviders(<ProductsView />, { route: '/seller/products?status=inactive' })
    expect(await screen.findByText('Không tìm thấy sản phẩm phù hợp')).toBeInTheDocument()
  })

  it('error state có nút thử lại', async () => {
    api.fetchProducts.mockRejectedValueOnce(new Error('boom'))
    api.fetchProducts.mockResolvedValueOnce(page([makeProduct()]))
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Áo thun basic')).toBeInTheDocument()
  })

  it('xóa cần xác nhận rồi chuyển vào thùng rác', async () => {
    const product = makeProduct()
    api.fetchProducts.mockResolvedValue(page([product]))
    api.trashProducts.mockResolvedValue({ trashed: 1, deactivated: 0 })
    renderWithProviders(
      <>
        <Notifications />
        <ProductsView />
      </>,
      { route: '/seller/products' },
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Áo thun basic' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Xóa' }))

    const dialog = await screen.findByRole('dialog', { name: 'Xóa sản phẩm?' })
    expect(dialog).toHaveTextContent('khôi phục trong 30 ngày')
    expect(api.trashProducts).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Chuyển vào thùng rác' }))
    await waitFor(() => expect(api.trashProducts).toHaveBeenCalledWith(['p1']))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Đã xóa "Áo thun basic"')).toBeInTheDocument()
  })

  it('chọn nhiều sản phẩm rồi xóa một lần; sản phẩm đã có đơn chỉ được ngừng bán', async () => {
    api.fetchProducts.mockResolvedValue(
      page([
        makeProduct(),
        makeProduct({ id: 'p2', name: 'Quần jean' }),
        makeProduct({ id: 'p3', name: 'Váy hoa' }),
      ]),
    )
    api.trashProducts.mockResolvedValue({ trashed: 1, deactivated: 1 })
    renderWithProviders(
      <>
        <Notifications />
        <ProductsView />
      </>,
      { route: '/seller/products' },
    )

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Chọn Áo thun basic' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Váy hoa' }))
    const bar = screen.getByRole('region', { name: 'Thao tác với sản phẩm đã chọn' })
    expect(bar).toHaveTextContent('Đã chọn 2 sản phẩm')
    expect(
      screen.getByRole('checkbox', { name: 'Chọn tất cả sản phẩm trên trang' }),
    ).toBePartiallyChecked()

    await userEvent.click(within(bar).getByRole('button', { name: 'Xóa 2 sản phẩm' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xóa 2 sản phẩm đã chọn?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chuyển vào thùng rác' }))

    await waitFor(() => expect(api.trashProducts).toHaveBeenCalledWith(['p1', 'p3']))
    expect(await screen.findByText(/1 sản phẩm đã có đơn hàng/)).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Thao tác với sản phẩm đã chọn' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('chưa có danh mục: icon đỏ, không cho đăng bán, bấm icon mở form sửa kèm cảnh báo', async () => {
    api.fetchProducts.mockResolvedValue(
      page([makeProduct({ category_id: null, category: null, is_active: false })]),
    )
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    const warning = await screen.findByRole('button', {
      name: 'Áo thun basic chưa có danh mục — chọn danh mục',
    })
    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Áo thun basic' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Đăng bán (cần chọn danh mục)' }),
    ).toBeDisabled()
    await userEvent.keyboard('{Escape}')

    await userEvent.click(warning)
    const dialog = await screen.findByRole('dialog', { name: 'Sửa sản phẩm' })
    expect(dialog).toHaveTextContent('Sản phẩm chưa có danh mục')
    expect(within(dialog).getByRole('combobox', { name: /Danh mục/ })).toHaveValue('')
  })

  it('lọc "Chưa có danh mục"', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    await userEvent.click(await screen.findByRole('combobox', { name: 'Trạng thái bán' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Chưa có danh mục' }))
    await waitFor(() =>
      expect(api.fetchProducts).toHaveBeenLastCalledWith(
        TEST_SELLER_ID,
        expect.objectContaining({ status: 'needs_category' }),
      ),
    )
  })

  it('chọn tất cả trên trang', async () => {
    api.fetchProducts.mockResolvedValue(
      page([makeProduct(), makeProduct({ id: 'p2', name: 'Quần jean' })]),
    )
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Chọn tất cả sản phẩm trên trang' }),
    )
    expect(screen.getByRole('checkbox', { name: 'Chọn Quần jean' })).toBeChecked()
    expect(screen.getByText('Đã chọn 2 sản phẩm')).toBeInTheDocument()
  })

  it('ô Sắp xếp: chọn "Giá vốn thấp → cao" ghi sort lên URL và tải lại', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    await userEvent.click(await screen.findByRole('combobox', { name: 'Sắp xếp' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Giá vốn thấp → cao' }))

    await waitFor(() =>
      expect(api.fetchProducts).toHaveBeenLastCalledWith(
        TEST_SELLER_ID,
        expect.objectContaining({ sort: 'cost_price', order: 'asc', page: 1 }),
      ),
    )
  })

  it('ngừng bán cần xác nhận; mở bán lại thì không', async () => {
    api.fetchProducts.mockResolvedValue(
      page([makeProduct(), makeProduct({ id: 'p2', name: 'Quần cũ', is_active: false })]),
    )
    api.setProductActive.mockResolvedValue()
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

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
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

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

  it('sửa nhanh giá bán: thông báo ghi rõ giá cũ → giá mới', async () => {
    // Toast của test trước còn trong store dùng chung → dọn để toast mới hiện ngay.
    act(() => notifications.clean())
    api.fetchProducts.mockResolvedValue(page([makeProduct({ price: 150_000 })]))
    api.updateProductPrice.mockResolvedValue()
    renderWithProviders(
      <>
        <Notifications />
        <ProductsView />
      </>,
      { route: '/seller/products' },
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Sửa nhanh giá của Áo thun basic' }),
    )
    const input = await screen.findByRole('textbox', { name: 'Sửa nhanh giá của Áo thun basic' })
    await userEvent.clear(input)
    await userEvent.type(input, '199000{Enter}')

    const toast = await screen.findByText('Đã cập nhật giá bán')
    expect(normalize(toast.closest('.mantine-Notification-root')?.textContent)).toContain(
      'Áo thun basic: 150.000 ₫ → 199.000 ₫',
    )
  })

  it('sửa nhanh giá vốn: cột giá vốn đứng trước giá bán, lưu giá trị mới', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    // Giữ request chưa xong để kiểm tra bảng cập nhật ngay (optimistic).
    api.updateProductCost.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ProductsView />, { route: '/seller/products' })

    await screen.findByText('Áo thun basic')
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '')
    expect(headers.findIndex((h) => h.includes('Giá vốn'))).toBeLessThan(
      headers.findIndex((h) => h.includes('Giá bán')),
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Sửa nhanh giá vốn của Áo thun basic' }),
    )
    const input = await screen.findByRole('textbox', {
      name: 'Sửa nhanh giá vốn của Áo thun basic',
    })
    await userEvent.clear(input)
    await userEvent.type(input, '95000{Enter}')

    await waitFor(() => expect(api.updateProductCost).toHaveBeenCalledWith('p1', 95_000))
    const cell = () => screen.getByRole('button', { name: 'Sửa nhanh giá vốn của Áo thun basic' })
    await waitFor(() => expect(normalize(cell().textContent)).toContain('95.000 ₫'))
  })
})

describe('ProductForm', () => {
  const fillRequired = async () => {
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo polo')
    await userEvent.click(screen.getByRole('combobox', { name: /Danh mục/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Áo polo' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Giá vốn/ }), '160000')
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
    expect(screen.getByText('Vui lòng nhập giá vốn')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập giá bán')).toBeInTheDocument()
    expect(api.createProduct).not.toHaveBeenCalled()
  })

  it('xem trước lãi gộp / sản phẩm; cảnh báo khi giá bán thấp hơn giá vốn', async () => {
    renderWithProviders(<ProductForm onDone={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox', { name: /Giá vốn/ }), '100000')
    await userEvent.type(screen.getByRole('textbox', { name: /Giá bán/ }), '150000')
    expect(screen.getByTestId('margin-preview')).toHaveTextContent(/50\.000\s₫ · 33,3%/)

    await userEvent.clear(screen.getByRole('textbox', { name: /Giá bán/ }))
    await userEvent.type(screen.getByRole('textbox', { name: /Giá bán/ }), '80000')
    expect(screen.getByText('Giá bán thấp hơn giá vốn')).toBeInTheDocument()
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
    expect(api.createProduct.mock.calls[0]?.[0]).toBe(TEST_SELLER_ID)
    expect(api.createProduct.mock.calls[0]?.[1]).toEqual({
      name: 'Áo polo',
      category_id: categoryIdOf('Áo polo'),
      unit: 'Cái',
      cost_price: 160_000,
      price: 250_000,
      stock: 0,
      low_stock_threshold: 5,
      description: null,
      is_active: true,
    })
    // Không có ảnh → media rỗng
    expect(api.createProduct.mock.calls[0]?.[2]).toEqual({ hero: null, gallery: [] })
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('"Thêm sản phẩm" lưu nhưng chưa đăng (is_active = false)', async () => {
    api.createProduct.mockResolvedValue(makeProduct({ is_active: false }))
    renderWithProviders(<ProductForm onDone={vi.fn()} />)

    await fillRequired()
    await userEvent.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledTimes(1))
    expect(api.createProduct.mock.calls[0]?.[1]).toMatchObject({ is_active: false })
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
        TEST_SELLER_ID,
        product,
        expect.objectContaining({ category_id: categoryIdOf('Áo thun'), is_active: false }),
        { hero: null, gallery: [] },
      ),
    )
  })
})

describe('ProductsView — admin xem chỉ đọc', () => {
  it('ẩn chọn nhiều, sửa nhanh và mọi thao tác ghi; vẫn xem được hiệu quả sản phẩm', async () => {
    api.fetchProducts.mockResolvedValue(page([makeProduct()]))
    renderWithProviders(<ProductsView />, {
      route: '/admin/sellers/s1?tab=products',
      sellerScope: { readOnly: true },
    })

    await screen.findByText('Áo thun basic')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sửa nhanh/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Thao tác cho Áo thun basic' }))
    expect(await screen.findByRole('menuitem', { name: 'Hiệu quả sản phẩm' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Sửa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Ngừng bán|Đăng bán/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Xóa' })).not.toBeInTheDocument()
  })

  it('shop chưa có sản phẩm: không có nút thêm sản phẩm', async () => {
    api.fetchProducts.mockResolvedValue(page([]))
    renderWithProviders(<ProductsView />, { route: '/admin', sellerScope: { readOnly: true } })
    expect(await screen.findByText('Chưa có sản phẩm nào')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Thêm sản phẩm/ })).not.toBeInTheDocument()
  })
})
