import {
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconBuildingStore,
  IconCash,
  IconChecklist,
  IconReceipt,
  IconTrashX,
  IconUserPlus,
} from '@tabler/icons-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { StatCard, StatCardSkeleton, StatGrid } from '@/shared/components/StatCard'
import { adminSellerPath, ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCompactCurrency, formatDateTime, formatNumber } from '@/shared/lib/formatters'
import {
  useAdminSellers,
  useAuditLogs,
  usePlatformRevenue,
  usePlatformStats,
} from '../api/admin.queries'
import { AuditLogTable } from './AuditLogView'

// Recharts chỉ tải khi trang tổng quan hiển thị biểu đồ (chunk riêng).
const PlatformRevenueChart = lazy(() => import('./PlatformRevenueChart'))

const RANGES = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
]

export function AdminOverview() {
  const [days, setDays] = useState(30)
  const stats = usePlatformStats(days)

  return (
    <Stack gap="lg">
      <Group justify="flex-end">
        <SegmentedControl
          aria-label="Khoảng thời gian"
          data={RANGES}
          value={String(days)}
          onChange={(value) => setDays(Number(value))}
          size="xs"
        />
      </Group>

      {stats.isError ? (
        <Paper withBorder radius="md" p="md">
          <ErrorState
            message={getErrorMessage(stats.error)}
            onRetry={() => void stats.refetch()}
            retrying={stats.isRefetching}
          />
        </Paper>
      ) : (
        <StatGrid cols={{ base: 1, xs: 2, lg: 3 }} aria-busy={stats.isFetching}>
          {stats.isPending ? (
            Array.from({ length: 6 }, (_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Hồ sơ chờ duyệt"
                value={formatNumber(stats.data.pending_count)}
                icon={<IconChecklist size={20} />}
                color="yellow"
                footer={
                  <Anchor component={Link} to={ROUTES.adminApprovals} size="xs">
                    Mở hàng đợi duyệt
                  </Anchor>
                }
              />
              <StatCard
                label="Shop đang hoạt động"
                value={formatNumber(stats.data.approved_count)}
                icon={<IconBuildingStore size={20} />}
                color="indigo"
                footer={
                  <Text size="xs" c="dimmed">
                    {formatNumber(stats.data.suspended_count)} tạm khóa ·{' '}
                    {formatNumber(stats.data.draft_count)} đang làm hồ sơ ·{' '}
                    {formatNumber(stats.data.rejected_count)} bị từ chối
                  </Text>
                }
              />
              <StatCard
                label={`Doanh số ${days} ngày`}
                value={formatCompactCurrency(stats.data.period_revenue)}
                icon={<IconCash size={20} />}
                color="green"
                footer={
                  <Text size="xs" c="dimmed">
                    Tổng: {formatCompactCurrency(stats.data.total_revenue)}
                  </Text>
                }
              />
              <StatCard
                label={`Đơn hàng ${days} ngày`}
                value={formatNumber(stats.data.period_orders)}
                icon={<IconReceipt size={20} />}
                color="cyan"
                footer={
                  <Text size="xs" c="dimmed">
                    Tổng: {formatNumber(stats.data.total_orders)} đơn
                  </Text>
                }
              />
              <StatCard
                label={`Tài khoản mới ${days} ngày`}
                value={formatNumber(stats.data.new_accounts)}
                icon={<IconUserPlus size={20} />}
                color="grape"
                footer={
                  <Text size="xs" c="dimmed">
                    {formatNumber(stats.data.total_accounts)} tài khoản ·{' '}
                    {formatNumber(stats.data.locked_accounts)} bị khóa
                  </Text>
                }
              />
              <StatCard
                label="Tài khoản chờ xóa"
                value={formatNumber(stats.data.pending_deletion_count)}
                icon={<IconTrashX size={20} />}
                color="red"
                footer={
                  <Anchor component={Link} to={ROUTES.adminDeletions} size="xs">
                    Xem danh sách
                  </Anchor>
                }
              />
            </>
          )}
        </StatGrid>
      )}

      <Section title={`Doanh số toàn nền tảng ${days} ngày qua`}>
        <RevenueSection days={days} />
      </Section>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Section
          title="Hồ sơ chờ duyệt"
          action={
            <Button component={Link} to={ROUTES.adminApprovals} variant="subtle" size="compact-sm">
              Xem tất cả
            </Button>
          }
        >
          <PendingQueue />
        </Section>
        <Section
          title="Hoạt động gần đây"
          action={
            <Button component={Link} to={ROUTES.adminAuditLog} variant="subtle" size="compact-sm">
              Nhật ký
            </Button>
          }
        >
          <RecentActivity />
        </Section>
      </SimpleGrid>
    </Stack>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="sm">
        <Title order={2} size="h5">
          {title}
        </Title>
        {action}
      </Group>
      {children}
    </Paper>
  )
}

function RevenueSection({ days }: { days: number }) {
  const revenue = usePlatformRevenue(days)
  if (revenue.isPending) return <Skeleton height={260} />
  if (revenue.isError) {
    return (
      <ErrorState
        message={getErrorMessage(revenue.error)}
        onRetry={() => void revenue.refetch()}
        retrying={revenue.isRefetching}
      />
    )
  }
  return (
    <Suspense fallback={<Skeleton height={260} />}>
      <PlatformRevenueChart data={revenue.data} days={days} />
    </Suspense>
  )
}

function PendingQueue() {
  const queue = useAdminSellers({ q: '', status: 'pending', page: 1, pageSize: 20 })
  if (queue.isPending) {
    return (
      <Stack gap="xs">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={36} />
        ))}
      </Stack>
    )
  }
  if (queue.isError) {
    return (
      <ErrorState
        message={getErrorMessage(queue.error)}
        onRetry={() => void queue.refetch()}
        retrying={queue.isRefetching}
      />
    )
  }
  const items = queue.data.items.slice(0, 5)
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconChecklist size={24} stroke={1.5} />}
        title="Không có hồ sơ chờ duyệt"
        description="Mọi hồ sơ đã được xử lý."
      />
    )
  }
  return (
    <Stack gap="xs">
      {items.map((seller) => (
        <Group key={seller.id} justify="space-between" wrap="nowrap" gap="sm">
          <Stack gap={0} miw={0}>
            <Text size="sm" fw={500} truncate="end">
              {seller.shop_name ?? 'Chưa đặt tên'}
            </Text>
            <Text size="xs" c="dimmed" truncate="end">
              {seller.owner_email} ·{' '}
              {seller.submitted_at ? formatDateTime(seller.submitted_at) : '—'}
            </Text>
          </Stack>
          <Button
            component={Link}
            to={adminSellerPath(seller.id)}
            size="compact-sm"
            variant="light"
          >
            Xét duyệt
          </Button>
        </Group>
      ))}
      {queue.data.total > items.length && (
        <Badge variant="light" color="gray" style={{ alignSelf: 'flex-start' }}>
          +{formatNumber(queue.data.total - items.length)} hồ sơ khác
        </Badge>
      )}
    </Stack>
  )
}

function RecentActivity() {
  const logs = useAuditLogs({ actor: '', action: '', from: '', to: '', page: 1, pageSize: 20 })
  if (logs.isError) {
    return (
      <ErrorState
        message={getErrorMessage(logs.error)}
        onRetry={() => void logs.refetch()}
        retrying={logs.isRefetching}
      />
    )
  }
  return <AuditLogTable entries={logs.data?.items.slice(0, 8)} loading={logs.isPending} compact />
}
