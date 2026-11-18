import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconBell,
  IconBellOff,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime } from '@/shared/lib/formatters'
import {
  useActivityLogs,
  useClearActivityLogs,
  useMarkAllActivityRead,
  useUnreadActivityCount,
} from '../api/activity.queries'
import { describePath, formatUnreadCount } from '../lib/activity'
import { formatChange, type ActivityChange } from '@/shared/lib/activityChanges'
import type { ActivityLevel, ActivityLog } from '../types'

const PAGE_SIZE = 30

const LEVEL_META: Readonly<
  Record<ActivityLevel, { color: string; label: string; icon: ReactNode }>
> = {
  success: { color: 'green', label: 'Thành công', icon: <IconCircleCheck size={16} /> },
  error: { color: 'red', label: 'Lỗi', icon: <IconCircleX size={16} /> },
  warning: { color: 'orange', label: 'Cảnh báo', icon: <IconAlertTriangle size={16} /> },
  info: { color: 'blue', label: 'Thông tin', icon: <IconInfoCircle size={16} /> },
}

/** Chuông thông báo trên header: số chưa xem (đỏ) + popover lịch sử hoạt động. */
export function NotificationBell() {
  const [opened, setOpened] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const unread = useUnreadActivityCount()
  const clear = useClearActivityLogs()
  const count = unread.data ?? 0

  return (
    <>
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-end"
        width="min(400px, calc(100vw - 32px))"
        shadow="md"
        withArrow
        arrowPosition="center"
        trapFocus
      >
        <Popover.Target>
          <Indicator
            label={formatUnreadCount(count)}
            color="red"
            size={18}
            offset={4}
            disabled={count === 0}
            styles={{ indicator: { fontWeight: 700, paddingInline: 4 } }}
          >
            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={() => setOpened((o) => !o)}
              aria-label={count > 0 ? `Thông báo (${count} chưa xem)` : 'Thông báo'}
              aria-haspopup="dialog"
              aria-expanded={opened}
            >
              <IconBell size={20} stroke={1.7} />
            </ActionIcon>
          </Indicator>
        </Popover.Target>
        <Popover.Dropdown p={0}>
          {opened && (
            <ActivityPanel
              onClear={() => {
                setOpened(false)
                setConfirmClear(true)
              }}
            />
          )}
        </Popover.Dropdown>
      </Popover>

      <ConfirmDialog
        opened={confirmClear}
        title="Xóa toàn bộ lịch sử thông báo?"
        message="Toàn bộ nhật ký hoạt động của tài khoản sẽ bị xóa vĩnh viễn và không khôi phục được."
        confirmLabel="Xóa tất cả"
        loading={clear.isPending}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => clear.mutate(undefined, { onSettled: () => setConfirmClear(false) })}
      />
    </>
  )
}

function ActivityPanel({ onClear }: { onClear: () => void }) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const logs = useActivityLogs(limit)
  const markRead = useMarkAllActivityRead()
  const markedRef = useRef(false)

  // Mở chuông = đã xem: đánh dấu sau khi tải xong danh sách để vẫn tô sáng được mục mới lần này.
  const hasUnread = logs.data?.items.some((item) => item.read_at === null) ?? false
  const { mutate: markAllRead } = markRead
  useEffect(() => {
    if (hasUnread && !markedRef.current) {
      markedRef.current = true
      markAllRead()
    }
  }, [hasUnread, markAllRead])

  const renderBody = () => {
    if (logs.isPending) {
      return (
        <Stack gap="sm" p="md" aria-busy data-testid="activity-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
              <Skeleton circle height={28} />
              <Stack gap={6} style={{ flex: 1 }}>
                <Skeleton height={12} width="70%" />
                <Skeleton height={10} />
              </Stack>
            </Group>
          ))}
        </Stack>
      )
    }
    if (logs.isError) {
      return (
        <Box p="sm">
          <ErrorState
            message={getErrorMessage(logs.error)}
            onRetry={() => void logs.refetch()}
            retrying={logs.isRefetching}
          />
        </Box>
      )
    }
    if (logs.data.items.length === 0) {
      return (
        <Stack align="center" gap={6} py="xl" px="md">
          <ThemeIcon variant="light" color="gray" size={44} radius="xl">
            <IconBellOff size={22} aria-hidden />
          </ThemeIcon>
          <Text fw={600} size="sm">
            Chưa có thông báo nào
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Các thao tác như tạo đơn, xác nhận đơn, nhập kho, sửa giá… sẽ được ghi lại ở đây.
          </Text>
        </Stack>
      )
    }
    return (
      <ScrollArea.Autosize mah="min(440px, 60vh)" type="auto">
        <Stack gap={0} component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {logs.data.items.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </Stack>
        {logs.data.hasMore && (
          <Group justify="center" p="xs">
            <Button
              variant="subtle"
              size="xs"
              loading={logs.isFetching}
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
            >
              Xem thêm thông báo cũ hơn
            </Button>
          </Group>
        )}
      </ScrollArea.Autosize>
    )
  }

  const hasItems = (logs.data?.items.length ?? 0) > 0

  return (
    <Stack gap={0} role="dialog" aria-label="Lịch sử thông báo">
      <Group justify="space-between" px="md" py="sm" wrap="nowrap">
        <Text fw={700}>Thông báo</Text>
        {hasItems && (
          <Button
            variant="subtle"
            color="red"
            size="compact-xs"
            leftSection={<IconTrash size={14} aria-hidden />}
            onClick={onClear}
          >
            Xóa tất cả
          </Button>
        )}
      </Group>
      <Divider />
      <div aria-busy={logs.isFetching}>{renderBody()}</div>
    </Stack>
  )
}

function ActivityItem({ item }: { item: ActivityLog }) {
  const meta = LEVEL_META[item.level]
  const page = describePath(item.path)
  const unread = item.read_at === null
  return (
    <Box
      component="li"
      px="md"
      py="sm"
      bg={unread ? 'var(--mantine-primary-color-light)' : undefined}
      style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color={meta.color} radius="xl" size={28} aria-label={meta.label}>
          {meta.icon}
        </ThemeIcon>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap" justify="space-between" align="flex-start">
            <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
              {item.title}
            </Text>
            {unread && (
              <Text size="10px" fw={700} c="red" tt="uppercase" style={{ whiteSpace: 'nowrap' }}>
                Mới
              </Text>
            )}
          </Group>
          {item.message && (
            <Text size="xs" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>
              {item.message}
            </Text>
          )}
          {item.changes.length > 0 && !changesInMessage(item) && (
            <ChangeList changes={item.changes} />
          )}
          <Text size="xs" c="dimmed">
            {formatDateTime(item.created_at)}
            {page ? ` · ${page}` : ''} · {meta.label}
          </Text>
        </Stack>
      </Group>
    </Box>
  )
}

/** Bảng "trường: cũ → mới"; giá trị cũ gạch ngang, giá trị mới in đậm. */
function ChangeList({ changes }: { changes: readonly ActivityChange[] }) {
  return (
    <Box
      component="dl"
      m={0}
      mt={4}
      p={6}
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'var(--mantine-color-default-hover)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        columnGap: 8,
        rowGap: 2,
      }}
      aria-label="Chi tiết thay đổi"
    >
      {changes.map((c, i) => (
        <Fragment key={i}>
          <Text component="dt" size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {c.field}
          </Text>
          <Text component="dd" size="xs" m={0} style={{ overflowWrap: 'anywhere' }}>
            {c.from === null ? (
              <Text span size="xs" c="dimmed">
                (trống)
              </Text>
            ) : (
              <Text span size="xs" c="dimmed" td="line-through">
                {c.from}
              </Text>
            )}
            <Text span size="xs" c="dimmed" mx={4} aria-label="thành">
              →
            </Text>
            {c.to === null ? (
              <Text span size="xs" c="dimmed">
                (trống)
              </Text>
            ) : (
              <Text span size="xs" fw={700}>
                {c.to}
              </Text>
            )}
          </Text>
        </Fragment>
      ))}
    </Box>
  )
}

/** Nội dung đã liệt kê đủ từng dòng "trường: cũ → mới" thì không lặp lại bảng chi tiết. */
function changesInMessage(item: ActivityLog): boolean {
  const message = item.message
  return message !== null && item.changes.every((c) => message.includes(formatChange(c)))
}
