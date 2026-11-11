import { Anchor, Paper } from '@mantine/core'
import { IconAlertTriangle, IconCash, IconClockHour4, IconShoppingCart } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { ErrorState } from '@/shared/components/ErrorState'
import { ChangeIndicator, StatCard, StatCardSkeleton, StatGrid } from '@/shared/components/StatCard'
import { ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { calcChange } from '@/shared/lib/metrics'
import { useDashboardKpis } from '../api/dashboard.queries'

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
      <StatGrid aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} testId="kpi-skeleton" />
        ))}
      </StatGrid>
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
    <StatGrid aria-busy={isPlaceholderData}>
      <StatCard
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
      <StatCard
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
      <StatCard
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
      <StatCard
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
    </StatGrid>
  )
}
