import { Box, Group, Paper, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { IconChartBar } from '@tabler/icons-react'
import {
  Bar,
  BarChart,
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
  formatNumber,
  formatPercent,
} from '@/shared/lib/formatters'
import { useRevenueByCategory } from '../api/analytics.queries'
import { foldCategories, type CategorySlice } from '../lib/analytics'
import type { ReportRange } from '../types'

// Một chuỗi (độ lớn) → một màu primary; biến CSS của Mantine tự đổi theo theme sáng / tối.
const BAR_COLOR = 'var(--mantine-primary-color-filled)'
const ROW_HEIGHT = 36

/** Doanh thu theo danh mục: bar ngang xếp hạng (nhãn dài đọc được, so sánh độ dài dễ). */
export function CategoryRevenueChart({ range }: { range: ReportRange }) {
  return (
    <WidgetCard title="Doanh thu theo danh mục">
      <CategoryRevenueContent range={range} />
    </WidgetCard>
  )
}

function CategoryRevenueContent({ range }: { range: ReportRange }) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useRevenueByCategory(range)

  if (isPending) return <Skeleton height={280} data-testid="category-chart-skeleton" />

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    )
  }

  const slices = foldCategories(data)
  if (slices.length === 0) {
    return (
      <EmptyState
        icon={<IconChartBar size={24} stroke={1.5} />}
        title="Chưa có doanh thu theo danh mục"
        description="Biểu đồ hiển thị khi có đơn hàng được xác nhận trong khoảng thời gian này."
      />
    )
  }

  const height = Math.max(160, slices.length * ROW_HEIGHT + 40)

  return (
    <div aria-busy={isPlaceholderData}>
      <Box
        h={height}
        role="img"
        aria-label={`Biểu đồ doanh thu theo ${slices.length} danh mục, cao nhất là ${slices[0]?.label}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={slices}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid horizontal={false} stroke="var(--mantine-color-default-border)" />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatCompactCurrency(value)}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--mantine-color-dimmed)"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="var(--mantine-color-dimmed)"
            />
            <Tooltip
              content={CategoryTooltip}
              cursor={{ fill: 'var(--mantine-color-default-hover)' }}
            />
            <Bar
              dataKey="revenue"
              name="Doanh thu"
              fill={BAR_COLOR}
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <CategoryTable slices={slices} />
    </div>
  )
}

function CategoryTooltip({ active, payload }: TooltipContentProps) {
  const slice = payload?.[0]?.payload as CategorySlice | undefined
  if (!active || !slice) return null
  return (
    <Paper withBorder shadow="sm" p="xs" radius="sm">
      <Text size="xs" fw={600} mb={4}>
        {slice.label}
      </Text>
      <Group gap="xs" justify="space-between">
        <Text size="sm">Doanh thu</Text>
        <Text size="sm" fw={600}>
          {formatCurrency(slice.revenue)}
        </Text>
      </Group>
      <Group gap="xs" justify="space-between">
        <Text size="sm">Tỉ trọng</Text>
        <Text size="sm" fw={600}>
          {formatPercent(slice.share)}
        </Text>
      </Group>
      <Group gap="xs" justify="space-between">
        <Text size="sm">Số lượng bán</Text>
        <Text size="sm" fw={600}>
          {formatNumber(slice.quantity)}
        </Text>
      </Group>
    </Paper>
  )
}

/** Bảng ẩn cho trình đọc màn hình — biểu đồ SVG không đọc được từng cột. */
function CategoryTable({ slices }: { slices: CategorySlice[] }) {
  return (
    <VisuallyHidden>
      <Table>
        <caption>Doanh thu theo danh mục</caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Danh mục</Table.Th>
            <Table.Th scope="col">Doanh thu</Table.Th>
            <Table.Th scope="col">Số lượng bán</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {slices.map((slice) => (
            <Table.Tr key={slice.label}>
              <Table.Td>{slice.label}</Table.Td>
              <Table.Td>{formatCurrency(slice.revenue)}</Table.Td>
              <Table.Td>{formatNumber(slice.quantity)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </VisuallyHidden>
  )
}
