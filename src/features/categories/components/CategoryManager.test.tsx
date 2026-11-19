import { Notifications } from '@mantine/notifications'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, TEST_SELLER_ID } from '@/test/render'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  reorderCategories,
  updateCategory,
} from '../api/categories.api'
import type { CategoryOverview } from '../types'
import { moveItem } from '../lib/moveItem'
import { CategoryManager } from './CategoryManager'

vi.mock('../api/categories.api', () => ({
  fetchCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  reorderCategories: vi.fn(),
  deleteCategory: vi.fn(),
}))

const api = {
  fetchCategories: vi.mocked(fetchCategories),
  createCategory: vi.mocked(createCategory),
  updateCategory: vi.mocked(updateCategory),
  reorderCategories: vi.mocked(reorderCategories),
  deleteCategory: vi.mocked(deleteCategory),
}

const category = (overrides: Partial<CategoryOverview> = {}): CategoryOverview => ({
  id: 'c1',
  name: 'Áo thun',
  slug: 'ao-thun',
  sort_order: 0,
  is_active: true,
  product_count: 0,
  active_count: 0,
  created_at: '2026-11-01T00:00:00Z',
  ...overrides,
})

const renderManager = (props: Parameters<typeof CategoryManager>[0] = {}, readOnly = false) =>
  renderWithProviders(
    <>
      <Notifications />
      <CategoryManager {...props} />
    </>,
    { sellerScope: { readOnly } },
  )

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})

describe('moveItem', () => {
  it('đổi chỗ với phần tử kế bên, giữ nguyên khi ở biên', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})

describe('CategoryManager', () => {
  it('đọc danh mục của đúng shop đang xem, kèm số sản phẩm / đang bán', async () => {
    api.fetchCategories.mockResolvedValue([
      category({ product_count: 5, active_count: 3 }),
      category({ id: 'c2', name: 'Đầm' }),
    ])
    renderManager()

    const row = (await screen.findByText('Áo thun')).closest('tr')
    if (!row) throw new Error('row')
    expect(row).toHaveTextContent('5')
    expect(row).toHaveTextContent('3 đang bán')
    expect(api.fetchCategories).toHaveBeenCalledWith(TEST_SELLER_ID)
  })

  it('danh sách trống', async () => {
    api.fetchCategories.mockResolvedValue([])
    renderManager()
    expect(await screen.findByText('Chưa có danh mục nào')).toBeInTheDocument()
  })

  it('thêm danh mục: gộp khoảng trắng, chặn tên rỗng / trùng ngay ở client', async () => {
    api.fetchCategories.mockResolvedValue([category()])
    api.createCategory.mockResolvedValue('c9')
    renderManager()
    await screen.findByText('Áo thun')
    const input = screen.getByRole('textbox', { name: 'Tên danh mục mới' })

    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
    expect(await screen.findByText('Vui lòng nhập tên danh mục')).toBeInTheDocument()

    await userEvent.type(input, ' áo   THUN ')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
    expect(await screen.findByText('Đã có danh mục cùng tên')).toBeInTheDocument()
    expect(api.createCategory).not.toHaveBeenCalled()

    await userEvent.clear(input)
    await userEvent.type(input, '  Áo   hoodie ')
    await userEvent.click(screen.getByRole('button', { name: 'Thêm danh mục' }))
    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith('Áo hoodie'))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('đổi tên danh mục, giữ trạng thái bật / tắt', async () => {
    api.fetchCategories.mockResolvedValue([category()])
    api.updateCategory.mockResolvedValue()
    renderManager()

    await userEvent.click(await screen.findByRole('button', { name: 'Đổi tên Áo thun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Đổi tên danh mục' })
    const input = within(dialog).getByRole('textbox', { name: /Tên danh mục/ })
    await userEvent.clear(input)
    await userEvent.type(input, 'Áo phông')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith('c1', 'Áo phông', true))
  })

  it('đổi thứ tự: gửi toàn bộ id theo thứ tự mới; nút ở biên bị khóa', async () => {
    api.fetchCategories.mockResolvedValue([
      category(),
      category({ id: 'c2', name: 'Đầm', sort_order: 1 }),
    ])
    api.reorderCategories.mockResolvedValue()
    renderManager()

    expect(await screen.findByRole('button', { name: 'Đưa Áo thun lên trên' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Đưa Đầm xuống dưới' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Đầm lên trên' }))
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalledWith(['c2', 'c1']))
  })

  it('xóa danh mục đang có sản phẩm: bắt buộc chọn danh mục để chuyển sang', async () => {
    api.fetchCategories.mockResolvedValue([
      category({ product_count: 4 }),
      category({ id: 'c2', name: 'Đầm', sort_order: 1 }),
    ])
    api.deleteCategory.mockResolvedValue({ moved: 4 })
    renderManager()

    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Áo thun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xóa danh mục "Áo thun"?' })
    expect(dialog).toHaveTextContent('4 sản phẩm')
    const confirm = within(dialog).getByRole('button', { name: 'Xóa danh mục' })
    expect(confirm).toBeDisabled()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /Chuyển sản phẩm sang/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Đầm' }))
    await userEvent.click(confirm)

    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('c1', 'c2'))
    expect(await screen.findByText('4 sản phẩm đã chuyển sang "Đầm".')).toBeInTheDocument()
  })

  it('xóa danh mục trống: không cần chọn danh mục chuyển sang', async () => {
    api.fetchCategories.mockResolvedValue([category()])
    api.deleteCategory.mockResolvedValue({ moved: 0 })
    renderManager()

    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Áo thun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xóa danh mục "Áo thun"?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa danh mục' }))
    await waitFor(() => expect(api.deleteCategory).toHaveBeenCalledWith('c1', null))
  })

  it('bước 3 hồ sơ: ẩn cột số sản phẩm', async () => {
    api.fetchCategories.mockResolvedValue([category()])
    renderManager({ showProductCounts: false })
    await screen.findByText('Áo thun')
    expect(screen.queryByRole('columnheader', { name: 'Số sản phẩm' })).not.toBeInTheDocument()
  })

  it('chế độ chỉ đọc: ẩn mọi nút ghi', async () => {
    api.fetchCategories.mockResolvedValue([category()])
    renderManager({}, true)
    await screen.findByText('Áo thun')
    expect(screen.queryByRole('button', { name: 'Thêm danh mục' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xóa Áo thun' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi tên Áo thun' })).not.toBeInTheDocument()
  })
})
