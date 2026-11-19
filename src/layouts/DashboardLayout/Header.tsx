import { Burger, Group, Text, ThemeIcon } from '@mantine/core'
import { IconBuildingStore } from '@tabler/icons-react'
import { NotificationBell } from '@/features/activity'
import { UserMenu } from '@/features/auth'
import { useUiStore } from '@/shared/stores/useUiStore'
import { ColorSchemeToggle } from './ColorSchemeToggle'

interface HeaderProps {
  /** Tên hiển thị trên header — tên shop của seller (mặc định "SellerOps"). */
  brand?: string
}

export function Header({ brand = 'SellerOps' }: HeaderProps) {
  const mobileNavOpened = useUiStore((s) => s.mobileNavOpened)
  const toggleMobileNav = useUiStore((s) => s.toggleMobileNav)

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
        <Group gap={8} wrap="nowrap">
          <ThemeIcon variant="filled" size="md" aria-hidden>
            <IconBuildingStore size={18} />
          </ThemeIcon>
          <Text fw={700} size="lg" truncate="end" maw={{ base: 180, sm: 360 }} title={brand}>
            {brand}
          </Text>
        </Group>
      </Group>
      <Group gap="sm" wrap="nowrap">
        <ColorSchemeToggle />
        <NotificationBell />
        <UserMenu />
      </Group>
    </Group>
  )
}
