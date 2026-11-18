import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '@/shared/stores/useUiStore'
import { renderWithProviders } from '@/test/render'
import { Sidebar } from './Sidebar'

/** Giả lập màn hình desktop (≥ 48em) hoặc mobile cho useMediaQuery. */
function mockDesktop(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => {
  useUiStore.setState({ desktopNavCollapsed: false, mobileNavOpened: false })
})

afterEach(() => {
  mockDesktop(false)
})

describe('Sidebar', () => {
  it('desktop: thu gọn còn icon (tên mục vẫn có qua aria-label), bấm lại để mở rộng', async () => {
    mockDesktop(true)
    renderWithProviders(<Sidebar />, { route: '/' })

    expect(screen.getByText('Sản phẩm')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh bên' }))

    expect(useUiStore.getState().desktopNavCollapsed).toBe(true)
    expect(screen.queryByText('Sản phẩm')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/products')

    await userEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh bên' }))
    expect(screen.getByText('Sản phẩm')).toBeInTheDocument()
  })

  it('mobile: luôn hiện đủ chữ, không có nút thu gọn', () => {
    mockDesktop(false)
    useUiStore.setState({ desktopNavCollapsed: true })
    renderWithProviders(<Sidebar />, { route: '/' })

    expect(screen.getByText('Sản phẩm')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /thanh bên/ })).not.toBeInTheDocument()
  })
})
