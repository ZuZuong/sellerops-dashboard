import { Badge, Group, Text } from '@mantine/core'
import { formatNumber } from '@/shared/lib/formatters'
import type { Product } from '../types'

/** Số tồn kho kèm nhãn cảnh báo (chữ + màu, không dựa riêng vào màu). */
export function ProductStock({ product }: { product: Pick<Product, 'stock' | 'is_low_stock'> }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(product.stock)}
      </Text>
      {product.stock === 0 ? (
        <Badge color="red" variant="light" size="sm">
          Hết hàng
        </Badge>
      ) : product.is_low_stock ? (
        <Badge color="orange" variant="light" size="sm">
          Sắp hết
        </Badge>
      ) : null}
    </Group>
  )
}
