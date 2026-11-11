import { Badge, Group, Stack, Table, Text } from '@mantine/core'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import type { OrderDetail } from '../types'

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

/**
 * Dòng hàng của đơn. Đơn giá là giá CHỐT lúc đặt (`unit_price`), không đọc lại giá hiện tại.
 * Đơn chờ xác nhận: cảnh báo dòng nào đang thiếu hàng so với tồn kho hiện tại.
 */
export function OrderItemsTable({ order }: { order: OrderDetail }) {
  const checkStock = order.status === 'pending'
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Sản phẩm</Table.Th>
            <Table.Th scope="col" ta="right">
              Đơn giá
            </Table.Th>
            <Table.Th scope="col" ta="right">
              SL
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Thành tiền
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {order.items.map((item) => {
            const short = checkStock && item.product !== null && item.product.stock < item.quantity
            return (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="sm" fw={500}>
                      {item.product?.name ?? 'Sản phẩm đã xóa'}
                    </Text>
                    <Group gap="xs">
                      {item.product && (
                        <Text size="xs" c="dimmed" ff="monospace">
                          {item.product.sku}
                        </Text>
                      )}
                      {item.product && !item.product.is_active && (
                        <Badge size="xs" color="gray" variant="light">
                          Ngừng bán
                        </Badge>
                      )}
                      {short && item.product && (
                        <Badge size="xs" color="orange" variant="light">
                          Thiếu hàng · tồn {formatNumber(item.product.stock)}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatCurrency(item.unit_price)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(item.quantity)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatCurrency(item.unit_price * item.quantity)}
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th scope="row" colSpan={3} ta="right">
              Tổng cộng
            </Table.Th>
            <Table.Td ta="right" style={numeric}>
              <Text fw={700}>{formatCurrency(order.total)}</Text>
            </Table.Td>
          </Table.Tr>
        </Table.Tfoot>
      </Table>
    </Table.ScrollContainer>
  )
}
