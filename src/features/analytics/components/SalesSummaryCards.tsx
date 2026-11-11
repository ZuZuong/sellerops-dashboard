import { Paper, Stack, Text } from '@mantine/core'
import {
  IconCash,
  IconCoins,
  IconPackage,
  IconPercentage,
  IconReceipt,
  IconShoppingCart,
  IconTrendingUp,
  IconTruckLoading,
} from '@tabler/icons-react'
import { ErrorState } from '@/shared/components/ErrorState'
import { ChangeIndicator, StatCard, StatCardSkeleton, StatGrid } from '@/shared/components/StatCard'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber, formatPercent } from '@/shared/lib/formatters'
import { calcChange, calcMargin } from '@/shared/lib/metrics'
import { useSalesSummary } from '../api/analytics.queries'
import { averageOrderValue } from '../lib/analytics'
import type { ReportRange } from '../types'

const PREVIOUS = 'so với kỳ trước'

/**
 * Chỉ số kỳ báo cáo, so với kỳ liền trước cùng độ dài:
 *  - Hàng 1 (kết quả kinh doanh): doanh thu, giá vốn hàng bán, lợi nhuận gộp, biên lợi nhuận gộp.
 *  - Hàng 2 (vận hành): đơn đã xác nhận, giá trị TB/đơn, sản phẩm đã bán, nhập hàng trong kỳ.
 * Giá vốn hàng bán = giá vốn bình quân đã chốt trên từng dòng đơn lúc xác nhận.
 */
export function SalesSummaryCards({ range }: { range: ReportRange }) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useSalesSummary(range)

  if (isPending) {
    return (
      <StatGrid aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <StatCardSkeleton key={i} testId="sales-summary-skeleton" />
        ))}
      </StatGrid>
    )
  }

  if (isError) {
    return (
      <Paper withBorder p="md" radius="md">
        <ErrorState
          title="Không tải được chỉ số kinh doanh"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      </Paper>
    )
  }

  const profit = data.revenue - data.cogs
  const prevProfit = data.prev_revenue - data.prev_cogs
  const margin = calcMargin(profit, data.revenue)
  const prevMargin = calcMargin(prevProfit, data.prev_revenue)
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
        label="Giá vốn hàng bán"
        value={formatCurrency(data.cogs)}
        icon={<IconCoins size={20} stroke={1.5} />}
        color="gray"
        footer={
          <ChangeIndicator
            change={calcChange(data.cogs, data.prev_cogs)}
            suffix={PREVIOUS}
            invert
          />
        }
      />
      <StatCard
        label="Lợi nhuận gộp"
        value={formatCurrency(profit)}
        icon={<IconTrendingUp size={20} stroke={1.5} />}
        color={profit < 0 ? 'red' : 'teal'}
        footer={<ChangeIndicator change={calcChange(profit, prevProfit)} suffix={PREVIOUS} />}
      />
      <StatCard
        label="Biên lợi nhuận gộp"
        value={margin === null ? '—' : formatPercent(margin)}
        icon={<IconPercentage size={20} stroke={1.5} />}
        color="grape"
        footer={
          <Text size="xs" c="dimmed">
            {prevMargin === null
              ? 'Kỳ trước: chưa có doanh thu'
              : `Kỳ trước ${formatPercent(prevMargin)}`}
          </Text>
        }
      />
      <StatCard
        label="Đơn đã xác nhận"
        value={formatNumber(data.order_count)}
        icon={<IconShoppingCart size={20} stroke={1.5} />}
        color="blue"
        footer={
          <Stack gap={2}>
            <ChangeIndicator
              change={calcChange(data.order_count, data.prev_order_count)}
              suffix={PREVIOUS}
            />
            <Text size="xs" c="dimmed">
              {formatNumber(data.cancelled_count)} đơn bị hủy trong kỳ
            </Text>
          </Stack>
        }
      />
      <StatCard
        label="Giá trị trung bình / đơn"
        value={formatCurrency(aov)}
        icon={<IconReceipt size={20} stroke={1.5} />}
        color="cyan"
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
      <StatCard
        label="Nhập hàng trong kỳ"
        value={formatCurrency(data.purchase_value)}
        icon={<IconTruckLoading size={20} stroke={1.5} />}
        color="orange"
        footer={
          <Text size="xs" c="dimmed">
            {formatNumber(data.purchase_qty)} sản phẩm đạt từ phiếu đã nhập kho
          </Text>
        }
      />
    </StatGrid>
  )
}
