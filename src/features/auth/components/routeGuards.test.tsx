import type { Session } from '@supabase/supabase-js'
import { screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '../hooks/useAuth'
import { GuestRoute } from './GuestRoute'
import { ProtectedRoute } from './ProtectedRoute'

const fakeSession = { user: { id: 'user-1', email: 'shop@example.com' } } as Session

function LocationProbe({ name }: { name: string }) {
  const { pathname, search } = useLocation()
  return <p>{`${name} ${pathname}${search}`}</p>
}

function renderAt(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        Component: ProtectedRoute,
        children: [{ path: '/orders', element: <LocationProbe name="orders" /> }],
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
    useAuthStore.setState({ status: 'loading', session: null })
  })

  it('hiện loader trong lúc chờ phiên đăng nhập', () => {
    renderAt('/orders')
    expect(screen.getByRole('status', { name: 'Đang tải trang' })).toBeInTheDocument()
  })

  it('chưa đăng nhập → chuyển sang /login', async () => {
    useAuthStore.getState().setSession(null)
    renderAt('/orders?status=pending')
    expect(await screen.findByText('login /login')).toBeInTheDocument()
  })

  it('đã đăng nhập → vào được trang được bảo vệ', async () => {
    useAuthStore.getState().setSession(fakeSession)
    renderAt('/orders')
    expect(await screen.findByText('orders /orders')).toBeInTheDocument()
  })

  it('đã đăng nhập mà mở /login → về dashboard', async () => {
    useAuthStore.getState().setSession(fakeSession)
    const router = renderAt('/login')
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('đăng nhập xong → quay lại đúng trang ban đầu kèm query string', async () => {
    useAuthStore.getState().setSession(null)
    renderAt('/orders?status=pending')
    await screen.findByText('login /login')

    useAuthStore.getState().setSession(fakeSession)
    expect(await screen.findByText('orders /orders?status=pending')).toBeInTheDocument()
  })
})
