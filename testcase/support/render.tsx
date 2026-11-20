import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { SellerScopeProvider } from '@/shared/components/SellerScopeProvider'
import type { SellerScope } from '@/shared/hooks/useSellerScope'
import { theme } from '@/styles/theme'

/** Shop mặc định trong test (component dữ liệu shop luôn chạy trong một SellerScope). */
export const TEST_SELLER_ID = '00000000-0000-4000-8000-000000000001'

/** QueryClient riêng cho mỗi test: không retry, không chia sẻ cache giữa các test. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

interface RenderWithProvidersOptions extends RenderOptions {
  /** Bọc thêm MemoryRouter tại URL này (cho component dùng Link / search params). */
  route?: string
  /** Ghi đè shop đang xem (mặc định TEST_SELLER_ID, không chỉ đọc). */
  sellerScope?: Partial<SellerScope>
}

/** Render với các provider dùng chung của app (Mantine, TanStack Query, SellerScope, tùy chọn Router). */
export function renderWithProviders(
  ui: ReactElement,
  { route, sellerScope, ...options }: RenderWithProvidersOptions = {},
) {
  const queryClient = createTestQueryClient()
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const content = (
      // env="test": tắt transition/animation của Mantine để dropdown, modal hiện ngay trong test.
      <MantineProvider theme={theme} env="test">
        <QueryClientProvider client={queryClient}>
          <SellerScopeProvider
            sellerId={sellerScope?.sellerId ?? TEST_SELLER_ID}
            readOnly={sellerScope?.readOnly ?? false}
          >
            {children}
          </SellerScopeProvider>
        </QueryClientProvider>
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
