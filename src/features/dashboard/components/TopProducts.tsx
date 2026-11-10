import { Group, Progress, Skeleton, Stack, Text } from '@mantine/core'
import { IconPackage } from '@tabler/icons-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { WidgetCard } from '@/shared/components/WidgetCard'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useTopProducts } from '../api/dashboard.queries'

const LIMIT = 5

interface TopProductsProps {
  days: number
}

export function TopProducts({ days }: TopProductsProps) {
  return (
    <WidgetCard title="Sản phẩm bán chạy">
      <TopProductsContent days={days} />
    </WidgetCard>
  )
}

function TopProductsContent({ days }: TopProductsProps) {
  const { data, isPending, isError, error, refetch, isRefetching, isPlaceholderData } =
    useTopProducts(days, LIMIT)

  if (isPending) {
    return (
      <Stack gap="md" aria-busy data-testid="top-products-skeleton">
        {Array.from({ length: LIMIT }, (_, i) => (
          <Stack key={i} gap={6}>
            <Group justify="space-between">
              <Skeleton height={12} width="55%" />
              <Skeleton height={12} width="20%" />
            </Group>
            <Skeleton height={6} />
          </Stack>
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
        icon={<IconPackage size={24} stroke={1.5} />}
        title={`Chưa bán được sản phẩm nào trong ${days} ngày qua`}
        description="Danh sách hiển thị khi có đơn hàng được xác nhận."
      />
    )
  }

  // Thanh tiến độ so với sản phẩm đứng đầu (theo số lượng bán).
  const maxQuantity = Math.max(...data.map((p) => p.quantity_sold), 1)

  return (
    <Stack
      component="ol"
      gap="md"
      m={0}
      p={0}
      style={{ listStyle: 'none' }}
      aria-busy={isPlaceholderData}
    >
      {data.map((product, index) => (
        <Stack component="li" key={product.product_id} gap={6}>
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Group gap="xs" wrap="nowrap" miw={0}>
              <Text size="sm" c="dimmed" fw={600} w={18} aria-hidden>
                {index + 1}
              </Text>
              <Stack gap={0} miw={0}>
                <Text size="sm" fw={500} truncate>
                  {product.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {product.sku} · {formatCurrency(product.revenue)}
                </Text>
              </Stack>
            </Group>
            <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
              {formatNumber(product.quantity_sold)} đã bán
            </Text>
          </Group>
          <Progress value={(product.quantity_sold / maxQuantity) * 100} size="sm" aria-hidden />
        </Stack>
      ))}
    </Stack>
  )
}
