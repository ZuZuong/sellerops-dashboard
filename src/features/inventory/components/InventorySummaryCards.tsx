import { Anchor, Paper, Text } from '@mantine/core'
import { IconAlertTriangle, IconBox, IconCash, IconPackageOff } from '@tabler/icons-react'
import { ErrorState } from '@/shared/components/ErrorState'
import { StatCard, StatCardSkeleton, StatGrid } from '@/shared/components/StatCard'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useInventorySummary } from '../api/inventory.queries'
import type { StockLevelFilter } from '../schemas/inventoryFilters.schema'

interface InventorySummaryCardsProps {
  /** Bấm "Xem danh sách" → lọc bảng theo mức tồn tương ứng. */
  onSelectLevel: (level: StockLevelFilter) => void
}

/** Tổng quan kho của sản phẩm đang bán (tính ở Postgres, không kéo toàn bộ sản phẩm về). */
export function InventorySummaryCards({ onSelectLevel }: InventorySummaryCardsProps) {
  const { data, isPending, isError, error, refetch, isRefetching } = useInventorySummary()

  if (isPending) {
    return (
      <StatGrid aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} testId="inventory-summary-skeleton" />
        ))}
      </StatGrid>
    )
  }

  if (isError) {
    return (
      <Paper withBorder p="md" radius="md">
        <ErrorState
          title="Không tải được tổng quan kho"
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      </Paper>
    )
  }

  const filterLink = (level: StockLevelFilter, label: string) => (
    <Anchor component="button" type="button" size="xs" onClick={() => onSelectLevel(level)}>
      {label}
    </Anchor>
  )

  return (
    <StatGrid>
      <StatCard
        label="Sản phẩm đang bán"
        value={formatNumber(data.product_count)}
        icon={<IconBox size={20} stroke={1.5} />}
        color="blue"
        footer={filterLink('all', 'Xem tất cả')}
      />
      <StatCard
        label="Sắp hết hàng"
        value={formatNumber(data.low_stock_count)}
        icon={<IconAlertTriangle size={20} stroke={1.5} />}
        color={data.low_stock_count > 0 ? 'orange' : 'gray'}
        footer={filterLink('low', 'Lọc sản phẩm sắp hết')}
      />
      <StatCard
        label="Hết hàng"
        value={formatNumber(data.out_of_stock_count)}
        icon={<IconPackageOff size={20} stroke={1.5} />}
        color={data.out_of_stock_count > 0 ? 'red' : 'gray'}
        footer={filterLink('out', 'Lọc sản phẩm hết hàng')}
      />
      <StatCard
        label="Giá trị tồn kho (giá vốn)"
        value={formatCurrency(data.stock_value)}
        icon={<IconCash size={20} stroke={1.5} />}
        color="teal"
        footer={
          <Text size="xs" c="dimmed">
            {formatNumber(data.total_units)} sản phẩm · theo giá bán{' '}
            {formatCurrency(data.retail_value)}
          </Text>
        }
      />
    </StatGrid>
  )
}
