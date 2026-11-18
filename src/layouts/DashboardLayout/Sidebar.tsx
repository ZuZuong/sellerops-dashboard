import {
  Button,
  Divider,
  NavLink as MantineNavLink,
  ScrollArea,
  Stack,
  Tooltip,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react'
import { NavLink } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { useUiStore } from '@/shared/stores/useUiStore'
import { NAV_ITEMS } from './navigation'

/** Độ rộng thanh bên trên desktop: mở rộng (icon + chữ) và thu gọn (chỉ icon). */
export const NAVBAR_WIDTH = 248
export const NAVBAR_COLLAPSED_WIDTH = 76

/** Breakpoint `sm` của Mantine (48em) — dưới mức này thanh bên là drawer, luôn hiện đủ chữ. */
const DESKTOP_QUERY = '(min-width: 48em)'

export function Sidebar() {
  const closeMobileNav = useUiStore((s) => s.closeMobileNav)
  const desktopNavCollapsed = useUiStore((s) => s.desktopNavCollapsed)
  const toggleDesktopNav = useUiStore((s) => s.toggleDesktopNav)
  const isDesktop = useMediaQuery(DESKTOP_QUERY) ?? false
  const mini = isDesktop && desktopNavCollapsed

  const toggleLabel = mini ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'

  return (
    <Stack h="100%" gap="xs">
      {isDesktop && (
        <>
          {/* Thanh ngang thu vào / kéo ra, nằm trên cùng thanh bên. */}
          <Tooltip label={toggleLabel} position="right" withArrow disabled={!mini}>
            <Button
              variant="light"
              color="gray"
              fullWidth
              h={40}
              px={mini ? 0 : 'md'}
              justify={mini ? 'center' : 'space-between'}
              onClick={toggleDesktopNav}
              aria-label={toggleLabel}
              aria-expanded={!mini}
              rightSection={mini ? undefined : <IconChevronsLeft size={20} aria-hidden />}
              styles={{ label: { fontWeight: 600 } }}
            >
              {mini ? <IconChevronsRight size={20} aria-hidden /> : 'Thu gọn'}
            </Button>
          </Tooltip>
          <Divider />
        </>
      )}

      <ScrollArea component="nav" aria-label="Điều hướng chính" type="never" style={{ flex: 1 }}>
        <Stack gap={6}>
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
            const link = (
              <MantineNavLink
                key={to}
                component={NavLink}
                to={to}
                end={to === ROUTES.dashboard}
                label={mini ? null : label}
                aria-label={mini ? label : undefined}
                leftSection={<Icon size={24} stroke={1.8} aria-hidden />}
                onClick={closeMobileNav}
                py="sm"
                px={mini ? 0 : 'md'}
                styles={{
                  root: {
                    borderRadius: 'var(--mantine-radius-md)',
                    justifyContent: mini ? 'center' : undefined,
                  },
                  section: mini ? { marginInlineEnd: 0 } : undefined,
                  body: mini ? { display: 'none' } : undefined,
                  label: { fontSize: 'var(--mantine-font-size-md)', fontWeight: 600 },
                }}
              />
            )
            // Thu gọn: chỉ còn icon → tooltip hiện tên mục (chuột và bàn phím).
            return mini ? (
              <Tooltip
                key={to}
                label={label}
                position="right"
                withArrow
                events={{ hover: true, focus: true, touch: false }}
              >
                {link}
              </Tooltip>
            ) : (
              link
            )
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}
