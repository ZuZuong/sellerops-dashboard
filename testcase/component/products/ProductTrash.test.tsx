import { Notifications } from '@mantine/notifications'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@test/render'
import {
  fetchProductTrash,
  purgeTrash,
  restoreProducts,
} from '@/features/products/api/productTrash.api'
import type { TrashedProduct } from '@/features/products/types'
import { daysUntilPurge } from '@/features/products/lib/trash'
import { ProductTrash } from '@/features/products/components/ProductTrash'

vi.mock('@/features/products/api/productTrash.api', () => ({
  fetchProductTrash: vi.fn(),
  restoreProducts: vi.fn(),
  purgeTrash: vi.fn(),
}))

const api = {
  fetchProductTrash: vi.mocked(fetchProductTrash),
  restoreProducts: vi.mocked(restoreProducts),
  purgeTrash: vi.mocked(purgeTrash),
}

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

const item = (overrides: Partial<TrashedProduct> = {}): TrashedProduct => ({
  id: 't1',
  sku: 'DN-AOPOLO-001',
  name: 'Áo polo',
  category: 'Áo polo',
  unit: 'Cái',
  price: 200_000,
  cost_price: 120_000,
  stock: 10,
  hero_image_path: null,
  deleted_at: '2026-11-17T03:00:00Z',
  purge_at: inDays(29.5),
  ...overrides,
})

const renderTrash = () =>
  renderWithProviders(
    <>
      <Notifications />
      <ProductTrash />
    </>,
  )

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})

describe('daysUntilPurge', () => {
  it('làm tròn lên, không âm', () => {
    const now = Date.parse('2026-11-17T00:00:00Z')
    expect(daysUntilPurge('2026-12-17T00:00:00Z', now)).toBe(30)
    expect(daysUntilPurge('2026-11-17T05:00:00Z', now)).toBe(1)
    expect(daysUntilPurge('2026-11-16T00:00:00Z', now)).toBe(0)
  })
})

describe('ProductTrash', () => {
  it('thùng rác trống', async () => {
    api.fetchProductTrash.mockResolvedValue({ items: [], total: 0 })
    renderTrash()
    expect(await screen.findByText('Thùng rác trống')).toBeInTheDocument()
  })

  it('hiện sản phẩm đã xóa và số ngày còn lại; khôi phục từng sản phẩm', async () => {
    api.fetchProductTrash.mockResolvedValue({ items: [item()], total: 1 })
    api.restoreProducts.mockResolvedValue({ restored: 1, skipped: [] })
    renderTrash()

    const row = (await screen.findByText('Áo polo', { selector: 'p' })).closest('tr')
    if (!row) throw new Error('row')
    expect(row).toHaveTextContent('DN-AOPOLO-001')
    expect(row).toHaveTextContent('Còn 30 ngày')

    await userEvent.click(within(row).getByRole('button', { name: 'Khôi phục Áo polo' }))
    await waitFor(() => expect(api.restoreProducts).toHaveBeenCalledWith(['t1']))
    expect(await screen.findByText('Đã khôi phục 1 sản phẩm')).toBeInTheDocument()
  })

  it('khôi phục bị bỏ qua vì trùng tên → cảnh báo', async () => {
    api.fetchProductTrash.mockResolvedValue({ items: [item()], total: 1 })
    api.restoreProducts.mockResolvedValue({ restored: 0, skipped: ['Áo polo'] })
    renderTrash()

    await userEvent.click(await screen.findByRole('button', { name: 'Khôi phục Áo polo' }))
    expect(await screen.findByText('1 sản phẩm chưa khôi phục được')).toBeInTheDocument()
  })

  it('chọn nhiều → xóa vĩnh viễn cần xác nhận', async () => {
    api.fetchProductTrash.mockResolvedValue({
      items: [item(), item({ id: 't2', name: 'Đầm maxi', sku: 'DN-DAMMAXI-002' })],
      total: 2,
    })
    api.purgeTrash.mockResolvedValue(2)
    renderTrash()

    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Chọn tất cả sản phẩm trên trang' }),
    )
    const bar = screen.getByRole('region', { name: 'Thao tác với sản phẩm đã chọn' })
    await userEvent.click(within(bar).getByRole('button', { name: 'Xóa vĩnh viễn 2' }))

    const dialog = await screen.findByRole('dialog', { name: 'Xóa vĩnh viễn 2 sản phẩm?' })
    expect(api.purgeTrash).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa vĩnh viễn' }))
    await waitFor(() => expect(api.purgeTrash).toHaveBeenCalledWith(['t1', 't2']))
  })

  it('lỗi tải → ErrorState', async () => {
    api.fetchProductTrash.mockRejectedValue(new Error('boom'))
    renderTrash()
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})
