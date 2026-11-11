import { Badge, Button, Group, Stack, Table, Text, VisuallyHidden } from '@mantine/core'
import { IconAdjustments, IconHistory } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { ProductStock } from '@/features/products'
import { SortableTh } from '@/shared/components/SortableTh'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import type { SortOrder } from '@/shared/types/sort'
import type { InventorySortField } from '../schemas/inventoryFilters.schema'
import type { InventoryItem } from '../types'

export const INVENTORY_TABLE_COLUMNS = 6

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

interface InventoryTableShellProps {
  sort: InventorySortField
  order: SortOrder
  onSort?: (field: InventorySortField) => void
  children: ReactNode
}

export function InventoryTableShell({ sort, order, onSort, children }: InventoryTableShellProps) {
  const sortProps = { sort, order, onSort }
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <SortableTh field="name" label="Sản phẩm" {...sortProps} />
            <SortableTh field="stock" label="Tồn kho" {...sortProps} />
            <Table.Th scope="col" ta="right">
              Ngưỡng cảnh báo
            </Table.Th>
            <SortableTh field="cost_price" label="Giá vốn" align="right" {...sortProps} />
            <Table.Th scope="col" ta="right">
              Giá trị tồn (giá vốn)
            </Table.Th>
            <Table.Th scope="col">
              <VisuallyHidden>Thao tác</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

interface InventoryTableProps extends Omit<InventoryTableShellProps, 'children'> {
  items: InventoryItem[]
  onAdjust: (item: InventoryItem) => void
  onHistory: (item: InventoryItem) => void
}

export function InventoryTable({ items, onAdjust, onHistory, ...shell }: InventoryTableProps) {
  return (
    <InventoryTableShell {...shell}>
      {items.map((item) => (
        <Table.Tr key={item.id} style={item.is_active ? undefined : { opacity: 0.7 }}>
          <Table.Td>
            <Stack gap={2}>
              <Text size="sm" fw={500} lineClamp={2} maw={300}>
                {item.name}
              </Text>
              <Group gap="xs">
                <Text size="xs" c="dimmed" ff="monospace">
                  {item.sku}
                </Text>
                {item.category && (
                  <Text size="xs" c="dimmed">
                    · {item.category}
                  </Text>
                )}
                {!item.is_active && (
                  <Badge size="xs" color="gray" variant="light">
                    Ngừng bán
                  </Badge>
                )}
              </Group>
            </Stack>
          </Table.Td>
          <Table.Td>
            <ProductStock product={item} />
          </Table.Td>
          <Table.Td ta="right" style={numeric}>
            <Text size="sm" c="dimmed">
              {formatNumber(item.low_stock_threshold)}
            </Text>
          </Table.Td>
          <Table.Td ta="right" style={numeric}>
            <Text size="sm">{formatCurrency(item.cost_price)}</Text>
            <Text size="xs" c="dimmed">
              Bán {formatCurrency(item.price)}
            </Text>
          </Table.Td>
          <Table.Td ta="right" style={numeric}>
            <Text size="sm">{formatCurrency(item.stock * item.cost_price)}</Text>
          </Table.Td>
          <Table.Td>
            <Group justify="flex-end" gap="xs" wrap="nowrap">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconAdjustments size={14} aria-hidden />}
                onClick={() => onAdjust(item)}
                aria-label={`Điều chỉnh kho ${item.name}`}
              >
                Điều chỉnh
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconHistory size={14} aria-hidden />}
                onClick={() => onHistory(item)}
                aria-label={`Lịch sử kho ${item.name}`}
              >
                Lịch sử
              </Button>
            </Group>
          </Table.Td>
        </Table.Tr>
      ))}
    </InventoryTableShell>
  )
}
