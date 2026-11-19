import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconBuildingStore,
  IconDots,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { adminSellerPath } from '@/shared/constants/routes'
import { useUrlState } from '@/shared/hooks/useUrlState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDate, formatDateTime } from '@/shared/lib/formatters'
import { useAdminAccounts, useSetAccountLocked } from '../api/admin.queries'
import { accountFiltersSchema, type AccountFilters } from '../schemas/adminFilters.schema'
import type { AdminAccount, DeletionTarget } from '../types'
import {
  AccountStateBadge,
  AdminPagination,
  RoleBadge,
  SearchField,
  SellerStatusBadge,
} from './common'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { ReasonDialog } from './ReasonDialog'

const ROLE_OPTIONS = [
  { value: 'all', label: 'Mọi vai trò' },
  { value: 'seller', label: 'Người bán' },
  { value: 'customer', label: 'Người mua' },
  { value: 'admin', label: 'Quản trị' },
]

const STATE_OPTIONS = [
  { value: 'all', label: 'Mọi trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'locked', label: 'Bị khóa' },
  { value: 'pending_deletion', label: 'Trong thùng rác' },
]

const COLUMNS = 7

/**
 * Quản lý tài khoản: tìm kiếm, lọc theo vai trò / trạng thái (lưu trên URL), khóa / mở khóa kèm
 * lý do, xóa tài khoản kèm bằng chứng. Tài khoản quản trị không có thao tác nào.
 */
export function AccountsView() {
  const { state: filters, setState } = useUrlState(accountFiltersSchema)
  const accounts = useAdminAccounts(filters)
  const lock = useSetAccountLocked()
  const [locking, setLocking] = useState<AdminAccount | null>(null)
  const [deleting, setDeleting] = useState<DeletionTarget | null>(null)

  const setFilters = (patch: Partial<AccountFilters>, replace = false) =>
    setState({ page: 1, ...patch }, { replace })

  const renderBody = () => {
    if (accounts.isPending) {
      return Array.from({ length: 8 }, (_, i) => (
        <Table.Tr key={i} data-testid="account-row-skeleton">
          {Array.from({ length: COLUMNS }, (_, j) => (
            <Table.Td key={j}>
              <Skeleton height={14} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))
    }
    return (accounts.data?.items ?? []).map((account) => (
      <AccountRow
        key={account.id}
        account={account}
        onLock={() => setLocking(account)}
        onDelete={() =>
          setDeleting({ userId: account.id, email: account.email, shopName: account.shop_name })
        }
      />
    ))
  }

  const isEmpty = accounts.data && accounts.data.items.length === 0

  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="sm" mb="md" wrap="wrap" align="flex-end">
        <SearchField
          value={filters.q}
          onCommit={(q) => setFilters({ q }, true)}
          placeholder="Tìm theo email, họ tên, tên shop…"
        />
        <Select
          aria-label="Vai trò"
          data={ROLE_OPTIONS}
          value={filters.role}
          onChange={(value) => {
            const role = accountFiltersSchema.shape.role.safeParse(value)
            if (role.success) setFilters({ role: role.data })
          }}
          allowDeselect={false}
          w={{ base: '100%', xs: 170 }}
        />
        <Select
          aria-label="Trạng thái tài khoản"
          data={STATE_OPTIONS}
          value={filters.state}
          onChange={(value) => {
            const state = accountFiltersSchema.shape.state.safeParse(value)
            if (state.success) setFilters({ state: state.data })
          }}
          allowDeselect={false}
          w={{ base: '100%', xs: 190 }}
        />
      </Group>

      {accounts.isError ? (
        <ErrorState
          message={getErrorMessage(accounts.error)}
          onRetry={() => void accounts.refetch()}
          retrying={accounts.isRefetching}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<IconUsers size={24} stroke={1.5} />}
          title="Không có tài khoản phù hợp"
          description="Thử từ khóa khác hoặc bỏ bớt điều kiện lọc."
        />
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table verticalSpacing="xs" highlightOnHover aria-busy={accounts.isFetching}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Tài khoản</Table.Th>
                <Table.Th scope="col">Vai trò</Table.Th>
                <Table.Th scope="col">Trạng thái</Table.Th>
                <Table.Th scope="col">Shop</Table.Th>
                <Table.Th scope="col">Ngày tạo</Table.Th>
                <Table.Th scope="col">Đăng nhập gần nhất</Table.Th>
                <Table.Th scope="col">
                  <VisuallyHidden>Thao tác</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{renderBody()}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <AdminPagination
        total={accounts.data?.total ?? 0}
        page={filters.page}
        pageSize={filters.pageSize}
        unit="tài khoản"
        onPage={(page) => setState({ page })}
        onPageSize={(pageSize) => setFilters({ pageSize })}
      />

      <ReasonDialog
        opened={locking !== null}
        title={locking?.is_locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
        description={
          locking?.is_locked
            ? `Mở khóa ${locking.email}: người dùng đăng nhập và thao tác lại bình thường.`
            : `Khóa ${locking?.email ?? ''}: người dùng mất mọi quyền ngay lập tức và thấy lý do khi đăng nhập.`
        }
        confirmLabel={locking?.is_locked ? 'Mở khóa' : 'Khóa tài khoản'}
        color={locking?.is_locked ? 'green' : 'red'}
        reasonRequired={!locking?.is_locked}
        loading={lock.isPending}
        onConfirm={(reason) => {
          if (!locking) return
          lock.mutate(
            { userId: locking.id, email: locking.email, locked: !locking.is_locked, reason },
            { onSuccess: () => setLocking(null) },
          )
        }}
        onClose={() => setLocking(null)}
      />
      <DeleteAccountDialog target={deleting} onClose={() => setDeleting(null)} />
    </Paper>
  )
}

function AccountRow({
  account,
  onLock,
  onDelete,
}: {
  account: AdminAccount
  onLock: () => void
  onDelete: () => void
}) {
  const manageable = account.role !== 'admin' && account.account_status === 'active'
  return (
    <Table.Tr>
      <Table.Td>
        <Stack gap={0} miw={0}>
          <Text size="sm" fw={500} truncate="end" maw={280}>
            {account.full_name || account.email}
          </Text>
          {account.full_name && (
            <Text size="xs" c="dimmed" truncate="end" maw={280}>
              {account.email}
            </Text>
          )}
          {!account.email_confirmed && (
            <Text size="xs" c="orange">
              Chưa xác minh email
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <RoleBadge role={account.role} />
      </Table.Td>
      <Table.Td>
        <AccountStateBadge account={account} />
      </Table.Td>
      <Table.Td>
        {account.seller_id ? (
          <Group gap={6} wrap="nowrap">
            <Text size="sm" truncate="end" maw={180}>
              {account.shop_name ?? 'Chưa đặt tên'}
            </Text>
            <SellerStatusBadge status={account.seller_status} />
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" c="dimmed">
          {formatDate(account.created_at)}
        </Text>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" c="dimmed">
          {account.last_sign_in_at ? formatDateTime(account.last_sign_in_at) : 'Chưa đăng nhập'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-end" gap={4} wrap="nowrap">
          {account.seller_id && (
            <Button
              component={Link}
              to={adminSellerPath(account.seller_id)}
              size="compact-xs"
              variant="subtle"
              leftSection={<IconBuildingStore size={14} aria-hidden />}
            >
              Xem shop
            </Button>
          )}
          {manageable && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Thao tác cho ${account.email}`}
                >
                  <IconDots size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={
                    account.is_locked ? <IconLockOpen size={16} /> : <IconLock size={16} />
                  }
                  onClick={onLock}
                >
                  {account.is_locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
                  Xóa tài khoản
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}
