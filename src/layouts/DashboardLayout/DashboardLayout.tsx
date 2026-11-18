import { AppShell, Box } from '@mantine/core'
import { Outlet, useNavigation } from 'react-router'
import { useUiStore } from '@/shared/stores/useUiStore'
import { Header } from './Header'
import { NAVBAR_COLLAPSED_WIDTH, NAVBAR_WIDTH, Sidebar } from './Sidebar'

export function DashboardLayout() {
  const mobileNavOpened = useUiStore((s) => s.mobileNavOpened)
  const desktopNavCollapsed = useUiStore((s) => s.desktopNavCollapsed)
  const isNavigating = useNavigation().state === 'loading'

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
        <Header />
      </AppShell.Header>
      <AppShell.Navbar p="sm" style={{ transition: 'width 200ms ease' }}>
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Box
          aria-busy={isNavigating}
          style={{ opacity: isNavigating ? 0.6 : 1, transition: 'opacity 150ms ease' }}
        >
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  )
}
