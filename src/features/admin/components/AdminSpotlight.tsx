import { Badge, Group, Text, UnstyledButton } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { IconBuildingStore, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SELLER_STATUS_META } from '@/features/sellers'
import { adminSellerPath } from '@/shared/constants/routes'
import { SEARCH_DEBOUNCE_MS } from '@/shared/hooks/useSearchInput'
import { useAdminSellers } from '../api/admin.queries'
import { ADMIN_PAGES } from '../lib/navigation'
import { normalizeSearch } from '../lib/search'

/** Nút mở thanh tìm kiếm nhanh trên header (kèm gợi ý phím tắt Ctrl+K). */
export function AdminSearchButton() {
  return (
    <UnstyledButton
      onClick={() => spotlight.open()}
      aria-label="Tìm kiếm nhanh (Ctrl+K)"
      px="sm"
      py={6}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Group gap="xs" wrap="nowrap">
        <IconSearch size={16} aria-hidden />
        <Text size="sm" c="dimmed" visibleFrom="sm">
          Tìm shop, trang…
        </Text>
        <Badge variant="default" size="sm" visibleFrom="sm" radius="sm">
          Ctrl + K
        </Badge>
      </Group>
    </UnstyledButton>
  )
}

/**
 * Tìm kiếm nhanh (Ctrl+K): nhảy tới trang quản trị hoặc tìm shop theo tên / email / mã số thuế
 * (tìm phía server, debounce 300ms).
 */
export function AdminSpotlight() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debounced] = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)
  const searching = debounced.length >= 2
  const sellers = useAdminSellers({ q: debounced, status: 'all', page: 1, pageSize: 20 }, searching)

  const key = normalizeSearch(query)
  const pages = ADMIN_PAGES.filter(
    (page) => key === '' || normalizeSearch(`${page.label} ${page.description}`).includes(key),
  )
  const shops = searching ? (sellers.data?.items.slice(0, 8) ?? []) : []

  const go = (to: string) => {
    navigate(to)
    spotlight.close()
  }

  return (
    <Spotlight.Root
      query={query}
      onQueryChange={setQuery}
      shortcut={['mod + K']}
      scrollable
      maxHeight={420}
    >
      <Spotlight.Search
        placeholder="Tìm trang quản trị hoặc shop (tên, email, mã số thuế)…"
        leftSection={<IconSearch size={18} aria-hidden />}
        aria-label="Tìm kiếm nhanh"
      />
      <Spotlight.ActionsList>
        {pages.length > 0 && (
          <Spotlight.ActionsGroup label="Trang">
            {pages.map((page) => (
              <Spotlight.Action
                key={page.to}
                label={page.label}
                description={page.description}
                leftSection={<page.icon size={18} aria-hidden />}
                onClick={() => go(page.to)}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {shops.length > 0 && (
          <Spotlight.ActionsGroup label="Shop">
            {shops.map((shop) => (
              <Spotlight.Action
                key={shop.id}
                label={shop.shop_name ?? 'Chưa đặt tên'}
                description={shop.owner_email}
                leftSection={<IconBuildingStore size={18} aria-hidden />}
                rightSection={
                  <Badge size="sm" variant="light" color={SELLER_STATUS_META[shop.status].color}>
                    {SELLER_STATUS_META[shop.status].label}
                  </Badge>
                }
                onClick={() => go(adminSellerPath(shop.id))}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {pages.length === 0 && shops.length === 0 && (
          <Spotlight.Empty>
            {searching && sellers.isFetching ? 'Đang tìm…' : 'Không tìm thấy kết quả phù hợp'}
          </Spotlight.Empty>
        )}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  )
}
