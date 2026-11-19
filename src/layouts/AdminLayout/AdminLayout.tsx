import '@mantine/spotlight/styles.css'
import {
  AppShell,
  Badge,
  Box,
  Burger,
  Group,
  NavLink as MantineNavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconShieldLock } from '@tabler/icons-react'
import { NavLink, Outlet, useNavigation } from 'react-router'
import { ADMIN_PAGES, AdminSearchButton, AdminSpotlight, usePlatformStats } from '@/features/admin'
import { UserMenu } from '@/features/auth'
import { ROUTES } from '@/shared/constants/routes'
import { formatNumber } from '@/shared/lib/formatters'
import { ColorSchemeToggle } from '../DashboardLayout/ColorSchemeToggle'
import classes from './AdminLayout.module.css'

/**
 * Khung Admin Console — khác hẳn dashboard seller nhưng dùng chung Mantine + token màu: thanh bên
 * navy đậm, một màu nhấn (vàng đồng) cho mục đang chọn, badge "Quản trị nền tảng" trên header.
 */
export function AdminLayout() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const isNavigating = useNavigation().state === 'loading'
  // Số việc cần xử lý hiển thị cạnh mục điều hướng.
  const stats = usePlatformStats(30)
  const counts: Partial<Record<string, number>> = {
    [ROUTES.adminApprovals]: stats.data?.pending_count,
    [ROUTES.adminDeletions]: stats.data?.pending_deletion_count,
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 248, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={opened ? 'Đóng menu' : 'Mở menu'}
            />
            <Text fw={700} size="lg">
              SellerOps
            </Text>
            <Badge color="yellow" variant="light" radius="sm" visibleFrom="xs">
              Quản trị nền tảng
            </Badge>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <AdminSearchButton />
            <ColorSchemeToggle />
            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" className={classes.navbar}>
        <Stack gap="md" h="100%">
          <Group gap="sm" px="xs" pt="xs" wrap="nowrap">
            <ThemeIcon color="yellow" variant="filled" size="lg" radius="md" aria-hidden>
              <IconShieldLock size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={700} c="white">
                Admin Console
              </Text>
              <Text size="xs" className={classes.muted}>
                Quản trị nền tảng
              </Text>
            </Stack>
          </Group>
          <ScrollArea
            component="nav"
            aria-label="Điều hướng quản trị"
            type="never"
            style={{ flex: 1 }}
          >
            <Stack gap={4}>
              {ADMIN_PAGES.map(({ label, to, icon: Icon }) => {
                const count = counts[to]
                return (
                  <MantineNavLink
                    key={to}
                    component={NavLink}
                    to={to}
                    end={to === ROUTES.admin}
                    label={label}
                    leftSection={<Icon size={20} stroke={1.8} aria-hidden />}
                    rightSection={
                      count ? (
                        <Badge
                          size="sm"
                          color="yellow"
                          variant="filled"
                          className={classes.count}
                          aria-label={`${count} việc cần xử lý`}
                        >
                          {formatNumber(count)}
                        </Badge>
                      ) : null
                    }
                    onClick={close}
                    className={classes.link}
                  />
                )
              })}
            </Stack>
          </ScrollArea>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box
          maw={1440}
          mx="auto"
          aria-busy={isNavigating}
          style={{ opacity: isNavigating ? 0.6 : 1, transition: 'opacity 150ms ease' }}
        >
          <Outlet />
        </Box>
      </AppShell.Main>
      <AdminSpotlight />
    </AppShell>
  )
}
