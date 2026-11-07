import { AppShell, Box } from '@mantine/core'
import { Outlet, useNavigation } from 'react-router'
import { useUiStore } from '@/shared/stores/useUiStore'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function DashboardLayout() {
  const mobileNavOpened = useUiStore((s) => s.mobileNavOpened)
  const desktopNavCollapsed = useUiStore((s) => s.desktopNavCollapsed)
  const isNavigating = useNavigation().state === 'loading'

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileNavOpened, desktop: desktopNavCollapsed },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Header />
      </AppShell.Header>
      <AppShell.Navbar p="sm">
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
