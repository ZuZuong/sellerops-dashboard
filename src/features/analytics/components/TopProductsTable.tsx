import { Progress, Skeleton, Stack, Table, Text } from '@mantine/core'
import { IconTrophy } from '@tabler/icons-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { WidgetCard } from '@/shared/components/WidgetCard'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber, formatPercent } from '@/shared/lib/formatters'
import { useTopProductsByRange } from '../api/analytics.queries'
import type { ReportRange } from '../types'

const LIMIT = 10
const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

export function TopProductsTable({ range }: { range: ReportRange }) {
  return (
    <WidgetCard title={`Top ${LIMIT} sản phẩm bán chạy`}>
      <TopProductsContent range={range} />
    </WidgetCard>
  )
}

function TopProductsContent({ range }: { range: ReportRange }) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useTopProductsByRange(range, LIMIT)

  if (isPending) {
    return (
      <Stack gap="sm" aria-busy data-testid="top-products-skeleton">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={28} />
        ))}
      </Stack>
    )
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

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<IconTrophy size={24} stroke={1.5} />}
        title="Chưa có sản phẩm bán ra"
        description="Danh sách hiển thị khi có đơn hàng được xác nhận trong khoảng thời gian này."
      />
    )
  }

  const topRevenue = data.reduce((max, row) => Math.max(max, row.revenue), 0)
  const totalRevenue = data.reduce((sum, row) => sum + row.revenue, 0)

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table verticalSpacing="xs" aria-busy={isPlaceholderData}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col" w={40}>
              #
            </Table.Th>
            <Table.Th scope="col">Sản phẩm</Table.Th>
            <Table.Th scope="col" ta="right">
              Đã bán
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Doanh thu
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((row, index) => (
            <Table.Tr key={row.product_id}>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {index + 1}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500} lineClamp={1}>
                  {row.name}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {row.sku}
                </Text>
              </Table.Td>
              <Table.Td ta="right" style={numeric}>
                {formatNumber(row.quantity_sold)}
              </Table.Td>
              <Table.Td ta="right" style={numeric} miw={150}>
                <Text size="sm">{formatCurrency(row.revenue)}</Text>
                <Progress
                  value={topRevenue > 0 ? (row.revenue / topRevenue) * 100 : 0}
                  size="xs"
                  mt={4}
                  aria-label={`Chiếm ${formatPercent(totalRevenue > 0 ? row.revenue / totalRevenue : 0)} doanh thu nhóm top`}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
