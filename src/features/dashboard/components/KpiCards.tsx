import { Anchor, Group, Paper, SimpleGrid, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core'
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconCash,
  IconClockHour4,
  IconMinus,
  IconShoppingCart,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { ErrorState } from '@/shared/components/ErrorState'
import { ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber, formatPercentChange } from '@/shared/lib/formatters'
import { useDashboardKpis } from '../api/dashboard.queries'
import { calcChange, getTrend, type Trend } from '../lib/kpi'

interface KpiCardsProps {
  days: number
}

export function KpiCards({ days }: KpiCardsProps) {
  return (
    <ErrorBoundary
      fallback={({ reset }) => (
        <Paper withBorder p="md" radius="md">
          <ErrorState message="Không hiển thị được chỉ số tổng quan." onRetry={reset} />
        </Paper>
      )}
    >
      <KpiCardsContent days={days} />
    </ErrorBoundary>
  )
}

function KpiCardsContent({ days }: KpiCardsProps) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useDashboardKpis(days)

  if (isPending) {
    return (
      <KpiGrid aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <Paper key={i} withBorder p="md" radius="md" data-testid="kpi-skeleton">
            <Skeleton height={14} width="50%" mb="md" />
            <Skeleton height={28} width="70%" mb="sm" />
            <Skeleton height={12} width="60%" />
          </Paper>
        ))}
      </KpiGrid>
    )
  }

  if (isError) {
    return (
      <Paper withBorder p="md" radius="md">
        <ErrorState
          title="Không tải được chỉ số tổng quan"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      </Paper>
    )
  }

  const periodLabel = `${days} ngày qua`
  const previousLabel = `so với ${days} ngày trước`

  return (
    <KpiGrid aria-busy={isPlaceholderData}>
      <KpiCard
        label={`Doanh thu · ${periodLabel}`}
        value={formatCurrency(data.revenue)}
        icon={<IconCash size={20} stroke={1.5} />}
        color="indigo"
        footer={
          <ChangeIndicator
            change={calcChange(data.revenue, data.prev_revenue)}
            suffix={previousLabel}
          />
        }
      />
      <KpiCard
        label={`Đơn hàng · ${periodLabel}`}
        value={formatNumber(data.order_count)}
        icon={<IconShoppingCart size={20} stroke={1.5} />}
        color="blue"
        footer={
          <ChangeIndicator
            change={calcChange(data.order_count, data.prev_order_count)}
            suffix={previousLabel}
          />
        }
      />
      <KpiCard
        label="Đơn chờ xử lý"
        value={formatNumber(data.pending_count)}
        icon={<IconClockHour4 size={20} stroke={1.5} />}
        color="yellow"
        footer={
          <Anchor component={Link} to={`${ROUTES.orders}?status=pending`} size="xs">
            Xem đơn chờ xác nhận
          </Anchor>
        }
      />
      <KpiCard
        label="Sản phẩm sắp hết hàng"
        value={formatNumber(data.low_stock_count)}
        icon={<IconAlertTriangle size={20} stroke={1.5} />}
        color={data.low_stock_count > 0 ? 'red' : 'gray'}
        footer={
          <Anchor component={Link} to={ROUTES.inventory} size="xs">
            Kiểm tra tồn kho
          </Anchor>
        }
      />
    </KpiGrid>
  )
}

function KpiGrid({ children, ...rest }: { children: ReactNode; 'aria-busy'?: boolean }) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md" {...rest}>
      {children}
    </SimpleGrid>
  )
}

interface KpiCardProps {
  label: string
  value: string
  icon: ReactNode
  color: string
  footer: ReactNode
}

function KpiCard({ label, value, icon, color, footer }: KpiCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} miw={0}>
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text fz={24} fw={700} lh={1.2} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Text>
        </Stack>
        <ThemeIcon variant="light" color={color} size={38} radius="md" aria-hidden>
          {icon}
        </ThemeIcon>
      </Group>
      <Group mt="sm" gap={4}>
        {footer}
      </Group>
    </Paper>
  )
}

// Màu chỉ bổ trợ: dấu +/- của phần trăm và icon mũi tên mới là thông tin chính (không dựa vào màu).
const TREND_META: Record<Trend, { color: string; icon: ReactNode }> = {
  up: { color: 'teal', icon: <IconArrowUpRight size={14} /> },
  down: { color: 'red', icon: <IconArrowDownRight size={14} /> },
  flat: { color: 'dimmed', icon: <IconMinus size={14} /> },
}

function ChangeIndicator({ change, suffix }: { change: number | null; suffix: string }) {
  const trend = getTrend(change)
  if (change === null || trend === null) {
    return (
      <Text size="xs" c="dimmed">
        Chưa có dữ liệu kỳ trước
      </Text>
    )
  }
  const meta = TREND_META[trend]
  return (
    <Text size="xs" c="dimmed" component="span">
      <Text
        component="span"
        size="xs"
        fw={600}
        c={meta.color}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2, verticalAlign: 'middle' }}
      >
        <span aria-hidden>{meta.icon}</span>
        {formatPercentChange(change)}
      </Text>{' '}
      {suffix}
    </Text>
  )
}
