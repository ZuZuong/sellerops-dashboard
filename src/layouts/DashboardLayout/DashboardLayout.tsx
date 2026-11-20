import { AppShell, Box } from '@mantine/core'
import type { ReactNode } from 'react'
import { Outlet, useNavigation } from 'react-router'
import { useActivityCapture } from '@/features/activity'
import { useUiStore } from '@/shared/stores/useUiStore'
import { Header } from './Header'
import { NAVBAR_COLLAPSED_WIDTH, NAVBAR_WIDTH, Sidebar } from './Sidebar'
import { DemoModeBanner } from '@/shared/components/DemoModeBanner'

interface DashboardLayoutProps {
  /** Nội dung thay cho route con (vd. khung trống phía sau modal khi shop bị khóa). */
  children?: ReactNode
  /** Tên hiển thị trên header (tên shop). */
  brand?: string
}

export function DashboardLayout({ children, brand }: DashboardLayoutProps) {
  const mobileNavOpened = useUiStore((s) => s.mobileNavOpened)
  const desktopNavCollapsed = useUiStore((s) => s.desktopNavCollapsed)
  const isNavigating = useNavigation().state === 'loading'
  // Ghi mọi thông báo hiển thị vào nhật ký hoạt động (chuông thông báo).
  useActivityCapture()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        // Desktop: thu gọn thành thanh icon (không ẩn hẳn); mobile: drawer đủ chữ.
        width: {
          base: NAVBAR_WIDTH,
          sm: desktopNavCollapsed ? NAVBAR_COLLAPSED_WIDTH : NAVBAR_WIDTH,
        },
        breakpoint: 'sm',
        collapsed: { mobile: !mobileNavOpened },
      }}
      transitionDuration={200}
      padding="md"
    >
      <AppShell.Header>
        <Header brand={brand} />
      </AppShell.Header>
      <AppShell.Navbar p="sm" style={{ transition: 'width 200ms ease' }}>
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Box
          aria-busy={isNavigating}
          style={{ opacity: isNavigating ? 0.6 : 1, transition: 'opacity 150ms ease' }}
        >
          <DemoModeBanner />
          {children ?? <Outlet />}
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
