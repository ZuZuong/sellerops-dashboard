import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  CloseButton,
  Group,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconEye, IconSearch } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SELLER_STATUS_META, type SellerStatus } from '@/features/sellers'
import { ROUTES } from '@/shared/constants/routes'
import { useSearchInput } from '@/shared/hooks/useSearchInput'
import { formatNumber } from '@/shared/lib/formatters'
import { accountStateOf, ROLE_META } from '../domain/labels'
import { NUMERIC_STYLE } from '../lib/styles'
import { ADMIN_PAGE_SIZES } from '../schemas/adminFilters.schema'
import type { AccountStatus, UserRole } from '../types'

interface Crumb {
  label: string
  to?: string
}

interface AdminPageHeaderProps {
  title: string
  description?: string
  /** Đường dẫn phía trên tiêu đề (trang gốc "Quản trị" luôn có sẵn). */
  crumbs?: readonly Crumb[]
  actions?: ReactNode
}

export function AdminPageHeader({
  title,
  description,
  crumbs = [],
  actions,
}: AdminPageHeaderProps) {
  const items: Crumb[] = [{ label: 'Quản trị', to: ROUTES.admin }, ...crumbs]
  return (
    <Stack gap={6} mb="lg">
      <Breadcrumbs separatorMargin={6} aria-label="Đường dẫn">
        {items.map((crumb) =>
          crumb.to ? (
            <Anchor key={crumb.label} component={Link} to={crumb.to} size="sm" c="dimmed">
              {crumb.label}
            </Anchor>
          ) : (
            <Text key={crumb.label} size="sm" c="dimmed" aria-current="page">
              {crumb.label}
            </Text>
          ),
        )}
      </Breadcrumbs>
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={2}>
          <Title order={1} size="h2">
            {title}
          </Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
        {actions && <Group gap="sm">{actions}</Group>}
      </Group>
    </Stack>
  )
}

export function SellerStatusBadge({ status }: { status: SellerStatus | null }) {
  if (!status) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    )
  }
  const meta = SELLER_STATUS_META[status]
  return (
    <Badge color={meta.color} variant="light" radius="sm">
      {meta.label}
    </Badge>
  )
}

export function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role]
  return (
    <Badge color={meta.color} variant="outline" radius="sm">
      {meta.label}
    </Badge>
  )
}

export function AccountStateBadge({
  account,
}: {
  account: { account_status: AccountStatus; is_locked: boolean }
}) {
  const meta = accountStateOf(account)
  return (
    <Badge color={meta.color} variant="light" radius="sm">
      {meta.label}
    </Badge>
  )
}

/** Ô tìm kiếm đồng bộ URL, debounce 300ms. */
export function SearchField({
  value,
  onCommit,
  placeholder,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder: string
}) {
  const [search, setSearch] = useSearchInput(value, onCommit)
  return (
    <TextInput
      aria-label={placeholder}
      placeholder={placeholder}
      leftSection={<IconSearch size={16} aria-hidden />}
      value={search}
      onChange={(event) => setSearch(event.currentTarget.value)}
      rightSection={
        search ? (
          <CloseButton size="sm" aria-label="Xóa từ khóa" onClick={() => setSearch('')} />
        ) : null
      }
      style={{ flex: '1 1 260px' }}
    />
  )
}

/** Chân bảng: tổng số dòng, chọn kích thước trang, phân trang. */
export function AdminPagination({
  total,
  page,
  pageSize,
  unit,
  onPage,
  onPageSize,
}: {
  total: number
  page: number
  pageSize: number
  unit: string
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <Group justify="space-between" mt="md" gap="sm" wrap="wrap">
      <Text size="sm" c="dimmed" style={NUMERIC_STYLE}>
        {formatNumber(from)}–{formatNumber(to)} / {formatNumber(total)} {unit}
      </Text>
      <Group gap="sm" wrap="wrap">
        <Select
          aria-label="Số dòng mỗi trang"
          data={ADMIN_PAGE_SIZES.map((size) => ({ value: String(size), label: `${size} / trang` }))}
          value={String(pageSize)}
          onChange={(value) => value && onPageSize(Number(value))}
          allowDeselect={false}
          w={130}
          size="xs"
        />
        <Pagination
          total={Math.max(1, Math.ceil(total / pageSize))}
          value={page}
          onChange={onPage}
          size="sm"
          getControlProps={(control) => ({
            'aria-label': control === 'previous' ? 'Trang trước' : 'Trang sau',
          })}
          getItemProps={(item) => ({ 'aria-label': `Trang ${item}` })}
        />
      </Group>
    </Group>
  )
}

/** Banner bắt buộc khi admin xem dữ liệu của một shop (không impersonation, không ghi được). */
export function ReadOnlyBanner() {
  return (
    <Alert
      color="indigo"
      variant="light"
      icon={<IconEye size={18} aria-hidden />}
      mb="md"
      role="status"
    >
      Đang xem với tư cách Admin, chỉ đọc. Mọi thao tác thay đổi dữ liệu của shop đều bị ẩn.
    </Alert>
  )
}
