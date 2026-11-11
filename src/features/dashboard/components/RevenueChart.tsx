import { Box, Group, Paper, Skeleton, Stack, Table, Text, VisuallyHidden } from '@mantine/core'
import { IconChartAreaLine } from '@tabler/icons-react'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { WidgetCard } from '@/shared/components/WidgetCard'
import { getErrorMessage } from '@/shared/lib/errors'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatShortDate,
} from '@/shared/lib/formatters'
import { useRevenueSeries } from '../api/dashboard.queries'
import { summarizeSeries } from '../lib/kpi'
import type { RevenuePoint } from '../types'

const CHART_HEIGHT = 280
// Một chuỗi duy nhất → dùng màu primary; biến CSS của Mantine tự đổi theo theme sáng/tối.
const SERIES_COLOR = 'var(--mantine-primary-color-filled)'

interface RevenueChartProps {
  days: number
}

export function RevenueChart({ days }: RevenueChartProps) {
  return (
    <WidgetCard title={`Doanh thu ${days} ngày qua`}>
      <RevenueChartContent days={days} />
    </WidgetCard>
  )
}

function RevenueChartContent({ days }: RevenueChartProps) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useRevenueSeries(days)

  if (isPending) {
    return <Skeleton height={CHART_HEIGHT} data-testid="revenue-chart-skeleton" />
  }

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    )
  }

  const summary = summarizeSeries(data)

  if (summary.revenue === 0) {
    return (
      <Box
        mih={CHART_HEIGHT}
        display="flex"
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <EmptyState
          icon={<IconChartAreaLine size={24} stroke={1.5} />}
          title={`Chưa có doanh thu trong ${days} ngày qua`}
          description="Doanh thu được ghi nhận khi đơn hàng được xác nhận."
        />
      </Box>
    )
  }

  return (
    <Stack gap="xs" aria-busy={isPlaceholderData}>
      <Text size="sm" c="dimmed">
        Tổng{' '}
        <Text span fw={600} c="var(--mantine-color-text)">
          {formatCurrency(summary.revenue)}
        </Text>{' '}
        từ {formatNumber(summary.orderCount)} đơn đã xác nhận
      </Text>
      <RevenueTrend data={data} />
    </Stack>
  )
}

/** Điểm dữ liệu tối thiểu để vẽ: ngày + doanh thu + số đơn (dashboard và trang Phân tích dùng chung). */
type TrendPoint = Pick<RevenuePoint, 'day' | 'revenue' | 'order_count'>

/** Biểu đồ vùng doanh thu theo ngày kèm bảng ẩn cho trình đọc màn hình. */
export function RevenueTrend({ data }: { data: readonly TrendPoint[] }) {
  return (
    <>
      <RevenueAreaChart data={data} />
      <RevenueTable data={data} />
    </>
  )
}

function RevenueAreaChart({ data }: { data: readonly TrendPoint[] }) {
  const gradientId = useId()
  const first = data[0]
  const last = data.at(-1)
  const label =
    first && last
      ? `Biểu đồ doanh thu theo ngày từ ${formatDate(first.day)} đến ${formatDate(last.day)}`
      : 'Biểu đồ doanh thu theo ngày'

  return (
    <Box h={CHART_HEIGHT} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--mantine-color-default-border)" />
          <XAxis
            dataKey="day"
            tickFormatter={(value: string) => formatShortDate(value)}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            fontSize={12}
            stroke="var(--mantine-color-dimmed)"
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactCurrency(value)}
            tickLine={false}
            axisLine={false}
            width={72}
            fontSize={12}
            stroke="var(--mantine-color-dimmed)"
          />
          <Tooltip
            content={RevenueTooltip}
            cursor={{ stroke: 'var(--mantine-color-dimmed)', strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Doanh thu"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--mantine-color-body)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}

function RevenueTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as TrendPoint | undefined
  if (!active || !point) return null
  return (
    <Paper withBorder shadow="sm" p="xs" radius="sm">
      <Text size="xs" c="dimmed" mb={4}>
        {formatDate(point.day)}
      </Text>
      <Group gap="xs" justify="space-between">
        <Text size="sm">Doanh thu</Text>
        <Text size="sm" fw={600}>
          {formatCurrency(point.revenue)}
        </Text>
      </Group>
      <Group gap="xs" justify="space-between">
        <Text size="sm">Số đơn</Text>
        <Text size="sm" fw={600}>
          {formatNumber(point.order_count)}
        </Text>
      </Group>
    </Paper>
  )
}

/** Bảng dữ liệu ẩn cho trình đọc màn hình — biểu đồ SVG không đọc được từng điểm. */
function RevenueTable({ data }: { data: readonly TrendPoint[] }) {
  return (
    <VisuallyHidden>
      <Table>
        <caption>Doanh thu theo ngày</caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Ngày</Table.Th>
            <Table.Th scope="col">Doanh thu</Table.Th>
            <Table.Th scope="col">Số đơn</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((point) => (
            <Table.Tr key={point.day}>
              <Table.Td>{formatDate(point.day)}</Table.Td>
              <Table.Td>{formatCurrency(point.revenue)}</Table.Td>
              <Table.Td>{formatNumber(point.order_count)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </VisuallyHidden>
  )
}
