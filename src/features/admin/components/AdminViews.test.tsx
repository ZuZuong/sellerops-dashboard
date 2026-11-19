import { Notifications } from '@mantine/notifications'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  fetchSellers,
  notifyAccountDeletion,
  requestAccountDeletion,
  setSellerSuspended,
} from '../api/admin.api'
import type { AdminSeller } from '../types'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { SellersView } from './SellersView'

vi.mock('../api/admin.api', () => ({
  fetchSellers: vi.fn(),
  setSellerSuspended: vi.fn(),
  requestAccountDeletion: vi.fn(),
  notifyAccountDeletion: vi.fn(),
  SELLER_DOCUMENTS_BUCKET: 'seller-documents',
  EVIDENCE_BUCKET: 'violation-evidence',
}))

const api = {
  fetchSellers: vi.mocked(fetchSellers),
  setSellerSuspended: vi.mocked(setSellerSuspended),
  requestAccountDeletion: vi.mocked(requestAccountDeletion),
  notifyAccountDeletion: vi.mocked(notifyAccountDeletion),
}

const seller = (overrides: Partial<AdminSeller> = {}): AdminSeller => ({
  id: 's1',
  shop_name: 'Shop An Nhiên',
  business_name: 'Hộ kinh doanh An Nhiên',
  status: 'approved',
  owner_id: 'u1',
  owner_email: 'an@example.com',
  account_status: 'active',
  is_locked: false,
  submitted_at: '2026-11-19T01:00:00Z',
  reviewed_at: '2026-11-19T02:00:00Z',
  created_at: '2026-11-18T00:00:00Z',
  product_count: 12,
  order_count: 5,
  revenue: 1_500_000,
  total_count: 1,
  ...overrides,
})

function SearchProbe() {
  return <p data-testid="search">{useLocation().search}</p>
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})

describe('SellersView', () => {
  const renderView = (route: string) =>
    renderWithProviders(
      <>
        <Notifications />
        <Routes>
          <Route
            path="/admin/sellers"
            element={
              <>
                <SellersView />
                <SearchProbe />
              </>
            }
          />
        </Routes>
      </>,
      { route },
    )

  it('đọc bộ lọc từ URL và gửi lên API', async () => {
    api.fetchSellers.mockResolvedValue({ items: [seller({ status: 'suspended' })], total: 1 })
    renderView('/admin/sellers?status=suspended&q=an&page=2')

    expect(await screen.findByText('Shop An Nhiên')).toBeInTheDocument()
    expect(api.fetchSellers).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspended', q: 'an', page: 2 }),
    )
  })

  it('đổi trạng thái ghi lên URL và về trang 1', async () => {
    api.fetchSellers.mockResolvedValue({ items: [seller()], total: 1 })
    renderView('/admin/sellers?page=3')
    await screen.findByText('Shop An Nhiên')

    await userEvent.click(screen.getByRole('radio', { name: 'Chờ duyệt' }))
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?status=pending'))
    expect(api.fetchSellers).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'pending', page: 1 }),
    )
  })

  it('tạm khóa shop bắt buộc nhập lý do', async () => {
    api.fetchSellers.mockResolvedValue({ items: [seller()], total: 1 })
    api.setSellerSuspended.mockResolvedValue()
    renderView('/admin/sellers')

    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác cho Shop An Nhiên' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Tạm khóa shop' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạm khóa shop' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạm khóa shop' }))
    expect(await within(dialog).findByText('Vui lòng nhập lý do')).toBeInTheDocument()
    expect(api.setSellerSuspended).not.toHaveBeenCalled()

    await userEvent.type(within(dialog).getByLabelText(/Lý do/), 'Bán hàng giả')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạm khóa shop' }))
    await waitFor(() =>
      expect(api.setSellerSuspended).toHaveBeenCalledWith('s1', true, 'Bán hàng giả'),
    )
  })

  it('danh sách rỗng → empty state', async () => {
    api.fetchSellers.mockResolvedValue({ items: [], total: 0 })
    renderView('/admin/sellers?q=khong-co')
    expect(await screen.findByText('Không có shop phù hợp')).toBeInTheDocument()
  })
})

describe('DeleteAccountDialog', () => {
  const target = { userId: 'u1', email: 'an@example.com', shopName: 'Shop An Nhiên' }
  const renderDialog = (onClose = vi.fn()) => {
    renderWithProviders(
      <>
        <Notifications />
        <DeleteAccountDialog target={target} onClose={onClose} />
      </>,
    )
    return onClose
  }

  it('lý do bắt buộc', async () => {
    renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Xóa tài khoản' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa tài khoản' }))
    expect(await within(dialog).findByText('Vui lòng nhập lý do')).toBeInTheDocument()
    expect(api.requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('xóa kèm bằng chứng → gửi email thông báo → đóng hộp thoại', async () => {
    api.requestAccountDeletion.mockResolvedValue('d1')
    api.notifyAccountDeletion.mockResolvedValue()
    const onClose = renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Xóa tài khoản' })

    await userEvent.type(within(dialog).getByLabelText(/Lý do xóa/), 'Kinh doanh hàng giả')
    const input = dialog.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('file input')
    await userEvent.upload(input, new File(['png'], 'vi-pham.png', { type: 'image/png' }))
    expect(await within(dialog).findByText(/vi-pham\.png/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa tài khoản' }))

    await waitFor(() => expect(api.requestAccountDeletion).toHaveBeenCalledTimes(1))
    const [userId, reason, files] = api.requestAccountDeletion.mock.calls[0] ?? []
    expect(userId).toBe('u1')
    expect(reason).toBe('Kinh doanh hàng giả')
    expect(files?.map((file) => file.name)).toEqual(['vi-pham.png'])
    await waitFor(() => expect(api.notifyAccountDeletion).toHaveBeenCalledWith('d1'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('gửi email lỗi → vẫn xóa thành công, báo có thể gửi lại', async () => {
    api.requestAccountDeletion.mockResolvedValue('d1')
    api.notifyAccountDeletion.mockRejectedValue(new Error('EMAIL_NOT_CONFIGURED'))
    renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'Xóa tài khoản' })
    await userEvent.type(within(dialog).getByLabelText(/Lý do xóa/), 'Vi phạm')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa tài khoản' }))

    expect(await screen.findByText('Chưa gửi được email thông báo')).toBeInTheDocument()
    expect(screen.getByText(/Máy chủ chưa cấu hình gửi email/)).toBeInTheDocument()
  })
})
