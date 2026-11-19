import type { Session } from '@supabase/supabase-js'
import { screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { fetchAccount, signOut, subscribeToOwnProfile } from '../api/auth.api'
import type { Account } from '../domain/account'
import { useAuthStore } from '../hooks/useAuth'
import { AccountGate } from './AccountGate'
import { GuestRoute } from './GuestRoute'
import { ProtectedRoute } from './ProtectedRoute'
import { HomeRedirect, RoleGuard } from './RoleGuard'

vi.mock('../api/auth.api', () => ({
  fetchAccount: vi.fn(),
  subscribeToOwnProfile: vi.fn(() => () => {}),
  signOut: vi.fn(),
  subscribeToAuthChanges: vi.fn(),
}))

const fetchAccountMock = vi.mocked(fetchAccount)
const signOutMock = vi.mocked(signOut)
const subscribeMock = vi.mocked(subscribeToOwnProfile)

const fakeSession = { user: { id: 'user-1', email: 'shop@example.com' } } as Session

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'user-1',
  email: 'shop@example.com',
  role: 'seller',
  fullName: null,
  status: 'active',
  isLocked: false,
  lockedReason: null,
  ...overrides,
})

function LocationProbe({ name }: { name: string }) {
  const { pathname, search } = useLocation()
  return <p>{`${name} ${pathname}${search}`}</p>
}

function renderAt(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        Component: ProtectedRoute,
        children: [
          {
            Component: AccountGate,
            children: [
              { path: '/', Component: HomeRedirect },
              { path: '/no-access', element: <LocationProbe name="no-access" /> },
              {
                element: <RoleGuard allow={['seller']} />,
                children: [
                  { path: '/seller/orders', element: <LocationProbe name="orders" /> },
                  { path: '/seller', element: <LocationProbe name="seller" /> },
                ],
              },
              {
                element: <RoleGuard allow={['admin']} />,
                children: [{ path: '/admin', element: <LocationProbe name="admin" /> }],
              },
            ],
          },
        ],
      },
      {
        Component: GuestRoute,
        children: [{ path: '/login', element: <LocationProbe name="login" /> }],
      },
    ],
    { initialEntries: [initialPath] },
  )
  renderWithProviders(<RouterProvider router={router} />)
  return router
}

describe('route guards', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'loading', session: null, recovery: false })
    fetchAccountMock.mockReset().mockResolvedValue(account())
    signOutMock.mockReset().mockResolvedValue()
  })

  it('hiện loader trong lúc chờ phiên đăng nhập', () => {
    renderAt('/seller/orders')
    expect(screen.getByRole('status', { name: 'Đang tải trang' })).toBeInTheDocument()
  })

  it('chưa đăng nhập → chuyển sang /login', async () => {
    useAuthStore.getState().setSession(null)
    renderAt('/seller/orders?status=pending')
    expect(await screen.findByText('login /login')).toBeInTheDocument()
  })

  it('seller đã đăng nhập → vào được trang seller', async () => {
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/seller/orders')
    expect(await screen.findByText('orders /seller/orders')).toBeInTheDocument()
  })

  it('đăng nhập xong → quay lại đúng trang ban đầu kèm query string', async () => {
    useAuthStore.getState().setSession(null)
    renderAt('/seller/orders?status=pending')
    await screen.findByText('login /login')

    useAuthStore.getState().setSession(fakeSession)
    expect(await screen.findByText('orders /seller/orders?status=pending')).toBeInTheDocument()
  })

  it.each([
    ['admin', 'admin /admin'],
    ['seller', 'seller /seller'],
    ['customer', 'no-access /no-access'],
  ] as const)(
    'mở / hoặc /login khi đã đăng nhập: role %s → trang chủ của role',
    async (role, text) => {
      fetchAccountMock.mockResolvedValue(account({ role }))
      useAuthStore.getState().setSession(fakeSession)
      renderAt('/login')
      expect(await screen.findByText(text)).toBeInTheDocument()
    },
  )

  it('sai vai trò: seller mở /admin → về /seller', async () => {
    useAuthStore.getState().setSession(fakeSession)
    const router = renderAt('/admin')
    expect(await screen.findByText('seller /seller')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/seller')
  })

  it('admin mở trang seller → về /admin', async () => {
    fetchAccountMock.mockResolvedValue(account({ role: 'admin' }))
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/seller/orders')
    expect(await screen.findByText('admin /admin')).toBeInTheDocument()
  })

  it('tài khoản bị khóa: màn hình khóa kèm lý do và nút đăng xuất, không vào được trang nào', async () => {
    fetchAccountMock.mockResolvedValue(account({ isLocked: true, lockedReason: 'Vi phạm nội quy' }))
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/seller/orders')

    expect(await screen.findByRole('heading', { name: 'Tài khoản đã bị khóa' })).toBeInTheDocument()
    expect(screen.getByText(/Vi phạm nội quy/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
    expect(screen.queryByText(/orders/)).not.toBeInTheDocument()
  })

  it('không tải được tài khoản → báo lỗi, có nút thử lại', async () => {
    fetchAccountMock.mockRejectedValue(new Error('boom'))
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/seller')
    expect(await screen.findByText('Không tải được thông tin tài khoản')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('tài khoản bị admin xóa → đăng xuất ngay, ghi lý do để trang đăng nhập thông báo', async () => {
    fetchAccountMock.mockResolvedValue(account({ status: 'pending_deletion', isLocked: true }))
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/seller/orders')

    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1))
    expect(useAuthStore.getState().signOutReason).toBe('account_removed')
    expect(screen.queryByText(/orders/)).not.toBeInTheDocument()
  })

  it('đang dùng app mà bị xóa (Realtime báo thay đổi) → đọc lại tài khoản và đăng xuất', async () => {
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/seller/orders')
    expect(await screen.findByText('orders /seller/orders')).toBeInTheDocument()
    expect(subscribeMock).toHaveBeenCalledWith('user-1', expect.any(Function))

    fetchAccountMock.mockResolvedValue(account({ status: 'pending_deletion', isLocked: true }))
    const onChange = subscribeMock.mock.calls.at(-1)?.[1]
    onChange?.()

    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1))
  })
})
