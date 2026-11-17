import { Notifications } from '@mantine/notifications'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  createProductCategory,
  deleteProductCategory,
  fetchProductCategories,
  renameProductCategory,
} from '../api/productCategories.api'
import type { ProductCategoryOverview } from '../types'
import { ProductCategoryManager } from './ProductCategoryManager'

vi.mock('../api/productCategories.api', () => ({
  fetchProductCategories: vi.fn(),
  createProductCategory: vi.fn(),
  renameProductCategory: vi.fn(),
  deleteProductCategory: vi.fn(),
}))

const api = {
  fetchProductCategories: vi.mocked(fetchProductCategories),
  createProductCategory: vi.mocked(createProductCategory),
  renameProductCategory: vi.mocked(renameProductCategory),
  deleteProductCategory: vi.mocked(deleteProductCategory),
}

const category = (overrides: Partial<ProductCategoryOverview> = {}): ProductCategoryOverview => ({
  id: 'c1',
  name: 'Áo thun',
  product_count: 0,
  active_count: 0,
  created_at: '2026-11-01T00:00:00Z',
  ...overrides,
})

const renderManager = () =>
  renderWithProviders(
    <>
      <Notifications />
      <ProductCategoryManager />
    </>,
  )

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})

describe('ProductCategoryManager', () => {
  it('liệt kê danh mục kèm số sản phẩm / đang bán', async () => {
    api.fetchProductCategories.mockResolvedValue([
      category({ product_count: 5, active_count: 3 }),
      category({ id: 'c2', name: 'Đầm' }),
    ])
    renderManager()

    const row = (await screen.findByText('Áo thun')).closest('tr')
    if (!row) throw new Error('row')
    expect(row).toHaveTextContent('5')
    expect(row).toHaveTextContent('3 đang bán')
  })

  it('danh sách trống', async () => {
    api.fetchProductCategories.mockResolvedValue([])
    renderManager()
    expect(await screen.findByText('Chưa có danh mục nào')).toBeInTheDocument()
  })

  it('thêm danh mục: gộp khoảng trắng, chặn tên rỗng / trùng ngay ở client', async () => {
    api.fetchProductCategories.mockResolvedValue([category()])
    api.createProductCategory.mockResolvedValue('c9')
    renderManager()
    await screen.findByText('Áo thun')
    const input = screen.getByRole('textbox', { name: 'Tên danh mục mới' })

    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
    expect(await screen.findByText('Vui lòng nhập tên danh mục')).toBeInTheDocument()

    await userEvent.type(input, ' áo THUN ')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
    expect(await screen.findByText('Đã có danh mục cùng tên')).toBeInTheDocument()
    expect(api.createProductCategory).not.toHaveBeenCalled()

    await userEvent.clear(input)
    await userEvent.type(input, '  Áo   hoodie ')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
    await waitFor(() => expect(api.createProductCategory).toHaveBeenCalledWith('Áo hoodie'))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('đổi tên danh mục', async () => {
    api.fetchProductCategories.mockResolvedValue([category({ product_count: 2 })])
    api.renameProductCategory.mockResolvedValue()
    renderManager()

    await userEvent.click(await screen.findByRole('button', { name: 'Đổi tên Áo thun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Đổi tên danh mục' })
    expect(dialog).toHaveTextContent('2 sản phẩm trong danh mục sẽ đổi theo tên mới')
    const input = within(dialog).getByRole('textbox', { name: /Tên danh mục/ })
    await userEvent.clear(input)
    await userEvent.type(input, 'Áo phông')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(api.renameProductCategory).toHaveBeenCalledWith('c1', 'Áo phông'))
  })

  it('xóa danh mục đang có sản phẩm bán: cảnh báo sản phẩm chuyển về lưu chưa đăng', async () => {
    api.fetchProductCategories.mockResolvedValue([category({ product_count: 4, active_count: 2 })])
    api.deleteProductCategory.mockResolvedValue({ products: 4, unpublished: 2 })
    renderManager()

    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Áo thun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xóa danh mục "Áo thun"?' })
    expect(dialog).toHaveTextContent('4 sản phẩm')
    expect(dialog).toHaveTextContent('2 sản phẩm đang bán sẽ tự chuyển về lưu chưa đăng')
    expect(api.deleteProductCategory).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa danh mục' }))
    await waitFor(() => expect(api.deleteProductCategory).toHaveBeenCalledWith('c1'))
    expect(
      await screen.findByText(/2 sản phẩm đang bán đã chuyển về lưu chưa đăng/),
    ).toBeInTheDocument()
  })
})
