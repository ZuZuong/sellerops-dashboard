import { Paper, Text } from '@mantine/core'
import { IconCash, IconPackage, IconReceipt, IconShoppingCart } from '@tabler/icons-react'
import { ErrorState } from '@/shared/components/ErrorState'
import { ChangeIndicator, StatCard, StatCardSkeleton, StatGrid } from '@/shared/components/StatCard'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { calcChange } from '@/shared/lib/metrics'
import { useSalesSummary } from '../api/analytics.queries'
import { averageOrderValue } from '../lib/analytics'
import type { ReportRange } from '../types'

const PREVIOUS = 'so với kỳ trước'

export function SalesSummaryCards({ range }: { range: ReportRange }) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useSalesSummary(range)

  if (isPending) {
    return (
      <StatGrid aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} testId="sales-summary-skeleton" />
        ))}
      </StatGrid>
    )
  }

  if (isError) {
    return (
      <Paper withBorder p="md" radius="md">
        <ErrorState
          title="Không tải được chỉ số doanh thu"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      </Paper>
    )
  }

  const aov = averageOrderValue(data.revenue, data.order_count)
  const prevAov = averageOrderValue(data.prev_revenue, data.prev_order_count)

  return (
    <StatGrid aria-busy={isPlaceholderData}>
      <StatCard
        label="Doanh thu"
        value={formatCurrency(data.revenue)}
        icon={<IconCash size={20} stroke={1.5} />}
        color="indigo"
        footer={
          <ChangeIndicator change={calcChange(data.revenue, data.prev_revenue)} suffix={PREVIOUS} />
        }
      />
      <StatCard
        label="Đơn đã xác nhận"
        value={formatNumber(data.order_count)}
        icon={<IconShoppingCart size={20} stroke={1.5} />}
        color="blue"
        footer={
          <Text size="xs" c="dimmed" component="div">
            <ChangeIndicator
              change={calcChange(data.order_count, data.prev_order_count)}
              suffix={PREVIOUS}
            />
            <div>{formatNumber(data.cancelled_count)} đơn bị hủy trong kỳ</div>
          </Text>
        }
      />
      <StatCard
        label="Giá trị trung bình / đơn"
        value={formatCurrency(aov)}
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="grape"
        footer={<ChangeIndicator change={calcChange(aov, prevAov)} suffix={PREVIOUS} />}
      />
      <StatCard
        label="Sản phẩm đã bán"
        value={formatNumber(data.items_sold)}
        icon={<IconPackage size={20} stroke={1.5} />}
        color="teal"
        footer={
          <ChangeIndicator
            change={calcChange(data.items_sold, data.prev_items_sold)}
            suffix={PREVIOUS}
          />
        }
      />
    </StatGrid>
  )
}
