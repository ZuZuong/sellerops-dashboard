import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Menu,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconDots,
  IconEye,
  IconMailForward,
  IconPaperclip,
  IconTrashX,
  IconUserCheck,
} from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { useUrlState } from '@/shared/hooks/useUrlState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime, formatFileSize } from '@/shared/lib/formatters'
import { EVIDENCE_BUCKET } from '../api/admin.api'
import {
  useAccountDeletions,
  useConfirmDeletion,
  useDeletionEvidence,
  useOpenPrivateFile,
  useResendDeletionEmail,
  useRestoreAccount,
} from '../api/admin.queries'
import { DELETION_STATUS_META } from '../domain/labels'
import { deletionFiltersSchema, type DeletionFilters } from '../schemas/adminFilters.schema'
import type { AccountDeletion } from '../types'
import { AdminPagination, SearchField } from './common'
import { ReasonDialog } from './ReasonDialog'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xóa' },
  { value: 'restored', label: 'Đã khôi phục' },
  { value: 'all', label: 'Tất cả' },
]

const COLUMNS = 6

/**
 * Tài khoản bị xóa (xóa mềm): chờ xác nhận → xác nhận xóa / khôi phục. Không bao giờ xóa vĩnh
 * viễn: "Xác nhận xóa" chỉ chuyển sang trạng thái đã xóa, dữ liệu được lưu giữ.
 */
export function DeletionsView() {
  const { state: filters, setState } = useUrlState(deletionFiltersSchema)
  const deletions = useAccountDeletions(filters)
  const confirm = useConfirmDeletion()
  const restore = useRestoreAccount()
  const resend = useResendDeletionEmail()
  const [confirming, setConfirming] = useState<AccountDeletion | null>(null)
  const [restoring, setRestoring] = useState<AccountDeletion | null>(null)
  const [viewing, setViewing] = useState<AccountDeletion | null>(null)

  const setFilters = (patch: Partial<DeletionFilters>, replace = false) =>
    setState({ page: 1, ...patch }, { replace })

  const renderBody = () => {
    if (deletions.isPending) {
      return Array.from({ length: 5 }, (_, i) => (
        <Table.Tr key={i} data-testid="deletion-row-skeleton">
          {Array.from({ length: COLUMNS }, (_, j) => (
            <Table.Td key={j}>
              <Skeleton height={14} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))
    }
    return (deletions.data?.items ?? []).map((deletion) => {
      const meta = DELETION_STATUS_META[deletion.status]
      const resending = resend.isPending && resend.variables.deletionId === deletion.id
      return (
        <Table.Tr key={deletion.id}>
          <Table.Td>
            <Stack gap={0} miw={0}>
              <Text size="sm" fw={500} truncate="end" maw={260}>
                {deletion.email}
              </Text>
              <Text size="xs" c="dimmed" truncate="end" maw={260}>
                {deletion.shop_name ? `Shop ${deletion.shop_name}` : 'Không có shop'}
              </Text>
            </Stack>
          </Table.Td>
          <Table.Td>
            <Text size="sm" lineClamp={2} maw={340} title={deletion.reason}>
              {deletion.reason}
            </Text>
            {deletion.evidence_count > 0 && (
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<IconPaperclip size={12} aria-hidden />}
                onClick={() => setViewing(deletion)}
                px={0}
              >
                {deletion.evidence_count} bằng chứng
              </Button>
            )}
          </Table.Td>
          <Table.Td style={{ whiteSpace: 'nowrap' }}>
            <Text size="sm">{formatDateTime(deletion.requested_at)}</Text>
            <Text size="xs" c="dimmed" truncate="end" maw={200}>
              bởi {deletion.requested_by_email ?? '—'}
            </Text>
          </Table.Td>
          <Table.Td>
            <Badge color={meta.color} variant="light" radius="sm">
              {meta.label}
            </Badge>
          </Table.Td>
          <Table.Td>
            {deletion.notified_at ? (
              <Tooltip label={`Đã gửi lúc ${formatDateTime(deletion.notified_at)}`}>
                <Badge color="green" variant="dot">
                  Đã gửi
                </Badge>
              </Tooltip>
            ) : (
              <Group gap={4} wrap="nowrap">
                <Badge color={deletion.notify_error ? 'red' : 'gray'} variant="dot">
                  {deletion.notify_error ? 'Gửi lỗi' : 'Chưa gửi'}
                </Badge>
                <Tooltip label="Gửi lại email thông báo">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    loading={resending}
                    aria-label={`Gửi lại email cho ${deletion.email}`}
                    onClick={() =>
                      resend.mutate({ deletionId: deletion.id, email: deletion.email })
                    }
                  >
                    <IconMailForward size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Table.Td>
          <Table.Td>
            {deletion.status !== 'restored' && (
              <Group justify="flex-end">
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Thao tác cho ${deletion.email}`}
                    >
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconUserCheck size={16} />}
                      onClick={() => setRestoring(deletion)}
                    >
                      Khôi phục tài khoản
                    </Menu.Item>
                    {deletion.status === 'pending' && (
                      <>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrashX size={16} />}
                          onClick={() => setConfirming(deletion)}
                        >
                          Xác nhận xóa
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            )}
          </Table.Td>
        </Table.Tr>
      )
    })
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm" mb="md">
        <SearchField
          value={filters.q}
          onCommit={(q) => setFilters({ q }, true)}
          placeholder="Tìm theo email, tên shop…"
        />
        <SegmentedControl
          aria-label="Lọc theo trạng thái xóa"
          data={STATUS_OPTIONS}
          value={filters.status}
          onChange={(value) => {
            const status = deletionFiltersSchema.shape.status.safeParse(value)
            if (status.success) setFilters({ status: status.data })
          }}
          style={{ alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}
        />
      </Stack>

      {deletions.isError ? (
        <ErrorState
          message={getErrorMessage(deletions.error)}
          onRetry={() => void deletions.refetch()}
          retrying={deletions.isRefetching}
        />
      ) : deletions.data && deletions.data.items.length === 0 ? (
        <EmptyState
          icon={<IconTrashX size={24} stroke={1.5} />}
          title={filters.status === 'pending' ? 'Không có tài khoản chờ xóa' : 'Không có dữ liệu'}
          description="Tài khoản bị xóa từ trang Tài khoản hoặc Shop sẽ xuất hiện ở đây."
        />
      ) : (
        <Table.ScrollContainer minWidth={980}>
          <Table verticalSpacing="xs" highlightOnHover aria-busy={deletions.isFetching}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Tài khoản</Table.Th>
                <Table.Th scope="col">Lý do</Table.Th>
                <Table.Th scope="col">Thời điểm xóa</Table.Th>
                <Table.Th scope="col">Trạng thái</Table.Th>
                <Table.Th scope="col">Email thông báo</Table.Th>
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
        total={deletions.data?.total ?? 0}
        page={filters.page}
        pageSize={filters.pageSize}
        unit="hồ sơ"
        onPage={(page) => setState({ page })}
        onPageSize={(pageSize) => setFilters({ pageSize })}
      />

      <ConfirmDialog
        opened={confirming !== null}
        title="Xác nhận xóa tài khoản?"
        message={`${confirming?.email ?? ''} chuyển sang "Đã xóa": tài khoản bị khóa vĩnh viễn, không đăng nhập được. Dữ liệu shop vẫn được lưu giữ và có thể khôi phục nếu khiếu nại được chấp nhận.`}
        confirmLabel="Xác nhận xóa"
        loading={confirm.isPending}
        onConfirm={() => {
          if (!confirming) return
          confirm.mutate(
            { deletionId: confirming.id, email: confirming.email },
            { onSettled: () => setConfirming(null) },
          )
        }}
        onClose={() => setConfirming(null)}
      />
      <ReasonDialog
        opened={restoring !== null}
        title="Khôi phục tài khoản"
        description={`Khôi phục ${restoring?.email ?? ''} về trạng thái trước khi bị xóa (vd. sau khi khiếu nại được chấp nhận).`}
        confirmLabel="Khôi phục"
        color="green"
        reasonRequired={false}
        reasonLabel="Ghi chú (vd. kết quả xử lý khiếu nại)"
        loading={restore.isPending}
        onConfirm={(note) => {
          if (!restoring) return
          restore.mutate(
            { deletionId: restoring.id, email: restoring.email, note },
            { onSuccess: () => setRestoring(null) },
          )
        }}
        onClose={() => setRestoring(null)}
      />
      <EvidenceDrawer deletion={viewing} onClose={() => setViewing(null)} />
    </Paper>
  )
}

function EvidenceDrawer({
  deletion,
  onClose,
}: {
  deletion: AccountDeletion | null
  onClose: () => void
}) {
  const evidence = useDeletionEvidence(deletion?.id ?? null)
  const file = useOpenPrivateFile(EVIDENCE_BUCKET)
  return (
    <Drawer
      opened={deletion !== null}
      onClose={onClose}
      title="Bằng chứng vi phạm"
      position="right"
      size="md"
    >
      {deletion && (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {deletion.email} · {formatDateTime(deletion.requested_at)}
          </Text>
          {evidence.isPending ? (
            <Skeleton height={80} />
          ) : evidence.isError ? (
            <ErrorState
              message={getErrorMessage(evidence.error)}
              onRetry={() => void evidence.refetch()}
              retrying={evidence.isRefetching}
            />
          ) : (
            evidence.data.map((item) => (
              <Group key={item.id} justify="space-between" wrap="nowrap">
                <Text size="sm" truncate="end">
                  {item.file_name} · {formatFileSize(item.file_size)}
                </Text>
                <Button
                  size="compact-sm"
                  variant="light"
                  leftSection={<IconEye size={14} aria-hidden />}
                  loading={file.pendingPath === item.storage_path}
                  onClick={() => file.open(item.storage_path)}
                  aria-label={`Xem ${item.file_name}`}
                >
                  Xem
                </Button>
              </Group>
            ))
          )}
          <Text size="xs" c="dimmed">
            Bằng chứng đã nộp không thể sửa hoặc xóa. Link xem chỉ có hiệu lực 60 giây.
          </Text>
        </Stack>
      )}
    </Drawer>
  )
}
