import { Burger, Group, Text, ThemeIcon } from '@mantine/core'
import { IconBuildingStore } from '@tabler/icons-react'
import { UserMenu } from '@/features/auth'
import { useUiStore } from '@/shared/stores/useUiStore'
import { ColorSchemeToggle } from './ColorSchemeToggle'

export function Header() {
  const mobileNavOpened = useUiStore((s) => s.mobileNavOpened)
  const desktopNavCollapsed = useUiStore((s) => s.desktopNavCollapsed)
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)
  const toggleDesktopNav = useUiStore((s) => s.toggleDesktopNav)

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <Burger
          opened={mobileNavOpened}
          onClick={toggleMobileNav}
          hiddenFrom="sm"
          size="sm"
          aria-label={mobileNavOpened ? 'Đóng menu' : 'Mở menu'}
        />
        <Burger
          opened={!desktopNavCollapsed}
          onClick={toggleDesktopNav}
          visibleFrom="sm"
          size="sm"
          aria-label={desktopNavCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        />
        <Group gap={8} wrap="nowrap">
          <ThemeIcon variant="filled" size="md" aria-hidden>
            <IconBuildingStore size={18} />
          </ThemeIcon>
          <Text fw={700} size="lg">
            SellerOps
          </Text>
        </Group>
      </Group>
      <Group gap="sm" wrap="nowrap">
        <ColorSchemeToggle />
        <UserMenu />
      </Group>
    </Group>
  )
}
