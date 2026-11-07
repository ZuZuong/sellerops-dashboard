import { NavLink as MantineNavLink, ScrollArea, Stack } from '@mantine/core'
import { NavLink } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { useUiStore } from '@/shared/stores/useUiStore'
import { NAV_ITEMS } from './navigation'

export function Sidebar() {
  const closeMobileNav = useUiStore((s) => s.closeMobileNav)

  return (
    <ScrollArea component="nav" aria-label="Điều hướng chính">
      <Stack gap={4}>
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <MantineNavLink
            key={to}
            component={NavLink}
            to={to}
            end={to === ROUTES.dashboard}
            label={label}
            leftSection={<Icon size={18} stroke={1.6} aria-hidden />}
            onClick={closeMobileNav}
          />
        ))}
      </Stack>
    </ScrollArea>
  )
}
