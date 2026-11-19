import { Box } from '@mantine/core'
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
} from 'recharts'
import { EmptyState } from '@/shared/components/EmptyState'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatShortDate,
} from '@/shared/lib/formatters'
import type { PlatformRevenuePoint } from '../types'

const CHART_HEIGHT = 260
const SERIES_COLOR = 'var(--mantine-primary-color-filled)'

/**
 * Doanh số toàn nền tảng theo ngày. File riêng + lazy-load ở trang tổng quan → Recharts nằm trong
 * chunk riêng, chỉ tải khi admin mở trang có biểu đồ.
 */
export default function PlatformRevenueChart({
  data,
  days,
}: {
  data: readonly PlatformRevenuePoint[]
  days: number
}) {
  const gradientId = useId()
  if (data.every((point) => point.revenue === 0)) {
    return (
      <Box
        mih={CHART_HEIGHT}
        display="flex"
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <EmptyState
          icon={<IconChartAreaLine size={24} stroke={1.5} />}
          title={`Chưa có doanh số trong ${days} ngày qua`}
          description="Doanh số được ghi nhận khi các shop xác nhận đơn hàng."
        />
      </Box>
    )
  }
  return (
    <Box h={CHART_HEIGHT} role="img" aria-label={`Biểu đồ doanh số toàn nền tảng ${days} ngày qua`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.3} />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--mantine-color-default-border)"
          />
          <XAxis
            dataKey="day"
            tickFormatter={(value: string) => formatShortDate(value)}
            tick={{ fontSize: 12, fill: 'var(--mantine-color-dimmed)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompactCurrency(value)}
            tick={{ fontSize: 12, fill: 'var(--mantine-color-dimmed)' }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), 'Doanh số']}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              background: 'var(--mantine-color-body)',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 8,
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}
