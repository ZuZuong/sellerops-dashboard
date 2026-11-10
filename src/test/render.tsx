import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { theme } from '@/styles/theme'

/** QueryClient riêng cho mỗi test: không retry, không chia sẻ cache giữa các test. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

interface RenderWithProvidersOptions extends RenderOptions {
  /** Bọc thêm MemoryRouter tại URL này (cho component dùng Link / search params). */
  route?: string
}

/** Render với các provider dùng chung của app (Mantine, TanStack Query, tùy chọn Router). */
export function renderWithProviders(
  ui: ReactElement,
  { route, ...options }: RenderWithProvidersOptions = {},
) {
  const queryClient = createTestQueryClient()
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const content = (
      <MantineProvider theme={theme}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MantineProvider>
    )
    return route === undefined ? (
      content
    ) : (
      <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
    )
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}
