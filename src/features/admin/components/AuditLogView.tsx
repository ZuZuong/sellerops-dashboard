import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { IconFilterOff, IconHistory } from '@tabler/icons-react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { adminSellerPath } from '@/shared/constants/routes'
import { useUrlState } from '@/shared/hooks/useUrlState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime } from '@/shared/lib/formatters'
import { useAdminAccounts, useAuditLogs } from '../api/admin.queries'
import { AUDIT_ACTION_OPTIONS, auditActionLabel, auditReason } from '../domain/labels'
import { auditFiltersSchema, type AuditFilters } from '../schemas/adminFilters.schema'
import type { AuditLogEntry } from '../types'
import { AdminPagination } from './common'

// Kiểm tra POSITIVE trước: "unsuspended" / "unlocked" cũng chứa "suspended" / "locked".
const POSITIVE = /approved|unsuspended|unlocked|restored/
const DESTRUCTIVE = /rejected|suspended|locked|deletion_requested|deletion_confirmed/

function actionColor(action: string) {
  if (POSITIVE.test(action)) return 'green'
  if (DESTRUCTIVE.test(action)) return 'red'
  return 'gray'
}

/** Bảng nhật ký (không có bộ lọc) — dùng ở trang Nhật ký, tab Nhật ký của shop, trang tổng quan. */
export function AuditLogTable({
  entries,
  loading,
  compact = false,
}: {
  entries: readonly AuditLogEntry[] | undefined
  loading: boolean
  compact?: boolean
}) {
  if (loading) {
    return (
      <Stack gap="xs">
        {Array.from({ length: compact ? 5 : 8 }, (_, i) => (
          <Skeleton key={i} height={compact ? 28 : 36} />
        ))}
      </Stack>
    )
  }
  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        icon={<IconHistory size={24} stroke={1.5} />}
        title="Chưa có hoạt động"
        description="Các hành động duyệt, khóa, xóa của quản trị viên sẽ xuất hiện ở đây."
      />
    )
  }
  return (
    <Table.ScrollContainer minWidth={compact ? 520 : 820}>
      <Table verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Thời điểm</Table.Th>
            <Table.Th scope="col">Hành động</Table.Th>
            <Table.Th scope="col">Đối tượng</Table.Th>
            {!compact && <Table.Th scope="col">Người thực hiện</Table.Th>}
            {!compact && <Table.Th scope="col">Lý do / ghi chú</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {entries.map((entry) => {
            const reason = auditReason(entry.metadata)
            return (
              <Table.Tr key={entry.id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDateTime(entry.created_at)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={actionColor(entry.action)} variant="light" radius="sm">
                    {auditActionLabel(entry.action)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {entry.target_type === 'seller' ? (
                    <Text
                      component={Link}
                      to={adminSellerPath(entry.target_id)}
                      size="sm"
                      fw={500}
                      truncate="end"
                      maw={240}
                    >
                      {entry.target_label ?? 'Shop'}
                    </Text>
                  ) : (
                    <Text size="sm" truncate="end" maw={240}>
                      {entry.target_label ?? 'Tài khoản'}
                    </Text>
                  )}
                </Table.Td>
                {!compact && (
                  <Table.Td>
                    <Text size="sm" truncate="end" maw={220}>
                      {entry.actor_email ?? 'Hệ thống'}
                    </Text>
                  </Table.Td>
                )}
                {!compact && (
                  <Table.Td>
                    <Text size="sm" c={reason ? undefined : 'dimmed'} lineClamp={2} maw={320}>
                      {reason ?? '—'}
                    </Text>
                  </Table.Td>
                )}
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

/** Trang Nhật ký: lọc theo người thực hiện, hành động, khoảng ngày (lưu trên URL). */
export function AuditLogView() {
  const { state: filters, setState, reset } = useUrlState(auditFiltersSchema)
  const logs = useAuditLogs(filters)
  const admins = useAdminAccounts({ q: '', role: 'admin', state: 'all', page: 1, pageSize: 100 })
  const setFilters = (patch: Partial<AuditFilters>) => setState({ page: 1, ...patch })
  const hasFilters = Boolean(filters.actor || filters.action || filters.from || filters.to)

  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="sm" mb="md" align="flex-end" wrap="wrap">
        <Select
          label="Người thực hiện"
          placeholder="Tất cả quản trị viên"
          data={(admins.data?.items ?? []).map((admin) => ({
            value: admin.id,
            label: admin.email,
          }))}
          value={filters.actor || null}
          onChange={(value) => setFilters({ actor: value ?? '' })}
          clearable
          searchable
          w={{ base: '100%', xs: 240 }}
        />
        <Select
          label="Hành động"
          placeholder="Mọi hành động"
          data={AUDIT_ACTION_OPTIONS}
          value={filters.action || null}
          onChange={(value) => setFilters({ action: value ?? '' })}
          clearable
          w={{ base: '100%', xs: 220 }}
        />
        <TextInput
          label="Từ ngày"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => setFilters({ from: event.currentTarget.value })}
          w={{ base: '100%', xs: 160 }}
        />
        <TextInput
          label="Đến ngày"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => setFilters({ to: event.currentTarget.value })}
          w={{ base: '100%', xs: 160 }}
        />
        {hasFilters && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={16} aria-hidden />}
            onClick={() => reset()}
          >
            Xóa bộ lọc
          </Button>
        )}
      </Group>

      {logs.isError ? (
        <ErrorState
          message={getErrorMessage(logs.error)}
          onRetry={() => void logs.refetch()}
          retrying={logs.isRefetching}
        />
      ) : (
        <div aria-busy={logs.isFetching}>
          <AuditLogTable entries={logs.data?.items} loading={logs.isPending} />
        </div>
      )}

      <AdminPagination
        total={logs.data?.total ?? 0}
        page={filters.page}
        pageSize={filters.pageSize}
        unit="hoạt động"
        onPage={(page) => setState({ page })}
        onPageSize={(pageSize) => setFilters({ pageSize })}
      />
    </Paper>
  )
}

/** Tab "Nhật ký" của một shop: hành động trên shop và trên tài khoản chủ shop. */
export function SellerActivityPanel({ sellerId, ownerId }: { sellerId: string; ownerId: string }) {
  const logs = useAuditLogs({
    actor: '',
    action: '',
    from: '',
    to: '',
    page: 1,
    pageSize: 100,
    targetIds: [sellerId, ownerId],
  })
  return (
    <Paper withBorder radius="md" p="md">
      {logs.isError ? (
        <ErrorState
          message={getErrorMessage(logs.error)}
          onRetry={() => void logs.refetch()}
          retrying={logs.isRefetching}
        />
      ) : (
        <AuditLogTable entries={logs.data?.items} loading={logs.isPending} />
      )}
    </Paper>
  )
}
