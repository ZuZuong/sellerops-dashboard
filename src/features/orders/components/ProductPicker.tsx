import { Group, Stack, Text } from '@mantine/core'
import { RemoteSearchSelect } from '@/shared/components/RemoteSearchSelect'
import { useRemoteSearch } from '@/shared/hooks/useRemoteSearch'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useOrderableProducts } from '../api/orders.queries'
import type { OrderableProduct } from '../types'

interface ProductPickerProps {
  label: string
  value: OrderableProduct | null
  onChange: (product: OrderableProduct | null) => void
  onBlur?: () => void
  /** Sản phẩm đã chọn ở dòng khác — ẩn khỏi danh sách để không chọn trùng. */
  excludeIds: ReadonlySet<string>
  error?: string
}

const getKey = (product: OrderableProduct) => product.id
const getLabel = (product: OrderableProduct) => product.name

/** Chọn sản phẩm đang bán cho đơn hàng, tìm theo tên / SKU phía server. */
export function ProductPicker({ value, excludeIds, ...props }: ProductPickerProps) {
  const search = useRemoteSearch(value?.name ?? null)
  const products = useOrderableProducts(search.term, search.activated)

  return (
    <RemoteSearchSelect
      {...props}
      value={value}
      search={search}
      items={products.data}
      loading={products.isFetching}
      failed={products.isError}
      getKey={getKey}
      getLabel={getLabel}
      excludeKeys={excludeIds}
      withAsterisk
      renderOption={(product) => (
        <Stack gap={0}>
          <Text size="sm">{product.name}</Text>
          <Group gap="xs">
            <Text size="xs" c="dimmed" ff="monospace">
              {product.sku}
            </Text>
            <Text size="xs" c="dimmed">
              · {formatCurrency(product.price)} · Tồn {formatNumber(product.stock)}
            </Text>
          </Group>
        </Stack>
      )}
    />
  )
}
