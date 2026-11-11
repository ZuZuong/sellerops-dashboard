import { Grid, Paper, Stack } from '@mantine/core'
import { useMemo } from 'react'
import { useAnalyticsRange } from '../hooks/useAnalyticsRange'
import { AnalyticsRangeControl } from './AnalyticsRangeControl'
import { CategoryRevenueChart } from './CategoryRevenueChart'
import { RevenueByDay } from './RevenueByDay'
import { SalesSummaryCards } from './SalesSummaryCards'
import { StockLedgerTable } from './StockLedgerTable'
import { TopProductsTable } from './TopProductsTable'

/**
 * Trang Phân tích: bộ lọc thời gian ở trên cùng (một hàng), các widget bên dưới tự lấy dữ liệu và
 * tự xử lý loading / empty / error độc lập.
 */
export function AnalyticsView() {
  const { range } = useAnalyticsRange()
  // Chỉ from / to vào query key (không kèm preset) → đổi preset ra cùng khoảng không gọi lại API.
  const report = useMemo(() => ({ from: range.from, to: range.to }), [range.from, range.to])

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <AnalyticsRangeControl />
      </Paper>
      <SalesSummaryCards range={report} />
      <RevenueByDay range={report} />
      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <CategoryRevenueChart range={report} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <TopProductsTable range={report} />
        </Grid.Col>
      </Grid>
      <StockLedgerTable range={report} />
    </Stack>
  )
}
