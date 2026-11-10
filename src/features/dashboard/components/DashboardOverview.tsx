import { Grid, Stack } from '@mantine/core'
import { useDashboardRange } from '../hooks/useDashboardRange'
import { KpiCards } from './KpiCards'
import { RecentOrders } from './RecentOrders'
import { RevenueChart } from './RevenueChart'
import { TopProducts } from './TopProducts'

/**
 * Bố cục trang Tổng quan. Mỗi widget tự lấy dữ liệu và tự xử lý loading/empty/error,
 * nên một widget lỗi hay chậm không chặn các widget còn lại.
 */
export function DashboardOverview() {
  const { days } = useDashboardRange()
  return (
    <Stack gap="md">
      <KpiCards days={days} />
      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <RevenueChart days={days} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <TopProducts days={days} />
        </Grid.Col>
        <Grid.Col span={12}>
          <RecentOrders />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
