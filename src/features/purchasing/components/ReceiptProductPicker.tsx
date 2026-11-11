import { Group, Stack, Text } from '@mantine/core'
import { RemoteSearchSelect } from '@/shared/components/RemoteSearchSelect'
import { useRemoteSearch } from '@/shared/hooks/useRemoteSearch'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useReceiptProducts } from '../api/purchases.queries'
import type { ReceiptProduct } from '../types'

interface ReceiptProductPickerProps {
  label: string
  value: ReceiptProduct | null
  onChange: (product: ReceiptProduct | null) => void
  onBlur?: () => void
  excludeIds: ReadonlySet<string>
  error?: string
}

const getKey = (product: ReceiptProduct) => product.id
const getLabel = (product: ReceiptProduct) => product.name

/** Chọn sản phẩm cho phiếu nhập: hiện SKU, tồn và giá vốn hiện tại để đối chiếu đơn giá nhập. */
export function ReceiptProductPicker({ value, excludeIds, ...props }: ReceiptProductPickerProps) {
  const search = useRemoteSearch(value?.name ?? null)
  const products = useReceiptProducts(search.term, search.activated)

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
              · Tồn {formatNumber(product.stock)} {product.unit} · Vốn{' '}
              {formatCurrency(product.cost_price)}
            </Text>
          </Group>
        </Stack>
      )}
    />
  )
}
