import { Box, Button, Skeleton, Stack, Text } from '@mantine/core'
import { IconChartAreaLine, IconDownload } from '@tabler/icons-react'
import { RevenueTrend } from '@/features/dashboard'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { WidgetCard } from '@/shared/components/WidgetCard'
import { downloadCsv } from '@/shared/lib/csv'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useRevenueByDay } from '../api/analytics.queries'
import { revenueToCsv } from '../lib/analytics'
import type { ReportRange } from '../types'

const CHART_HEIGHT = 280

export function RevenueByDay({ range }: { range: ReportRange }) {
  const query = useRevenueByDay(range)
  const rows = query.data

  return (
    <WidgetCard
      title="Doanh thu theo ngày"
      actions={
        <Button
          size="xs"
          variant="default"
          leftSection={<IconDownload size={14} aria-hidden />}
          disabled={!rows || rows.length === 0}
          onClick={() =>
            rows && downloadCsv(`doanh-thu_${range.from}_${range.to}.csv`, revenueToCsv(rows))
          }
        >
          Xuất CSV
        </Button>
      }
    >
      {query.isPending ? (
        <Skeleton height={CHART_HEIGHT} data-testid="revenue-by-day-skeleton" />
      ) : query.isError ? (
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      ) : (
        <RevenueByDayContent rows={query.data} busy={query.isPlaceholderData} />
      )}
    </WidgetCard>
  )
}

function RevenueByDayContent({
  rows,
  busy,
}: {
  rows: NonNullable<ReturnType<typeof useRevenueByDay>['data']>
  busy: boolean
}) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const orders = rows.reduce((sum, row) => sum + row.order_count, 0)

  if (revenue === 0) {
    return (
      <Box
        mih={CHART_HEIGHT}
        display="flex"
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <EmptyState
          icon={<IconChartAreaLine size={24} stroke={1.5} />}
          title="Chưa có doanh thu trong khoảng này"
          description="Doanh thu được ghi nhận khi đơn hàng được xác nhận. Thử chọn khoảng thời gian khác."
        />
      </Box>
    )
  }

  return (
    <Stack gap="xs" aria-busy={busy}>
      <Text size="sm" c="dimmed">
        Tổng{' '}
        <Text span fw={600} c="var(--mantine-color-text)">
          {formatCurrency(revenue)}
        </Text>{' '}
        từ {formatNumber(orders)} đơn đã xác nhận
      </Text>
      <RevenueTrend data={rows} />
    </Stack>
  )
}
