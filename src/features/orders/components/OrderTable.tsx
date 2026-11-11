import { ActionIcon, Anchor, Group, Menu, Stack, Table, Text, VisuallyHidden } from '@mantine/core'
import { IconDots, IconEye } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SortableTh } from '@/shared/components/SortableTh'
import { orderDetailPath } from '@/shared/constants/routes'
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters'
import type { SortOrder } from '@/shared/types/sort'
import { getNextStatuses, ORDER_ACTIONS, type OrderTransitionTarget } from '../domain/orderStatus'
import type { OrderSortField } from '../schemas/orderFilters.schema'
import type { Order } from '../types'
import { OrderStatusBadge } from './OrderStatusBadge'

export const ORDER_TABLE_COLUMNS = 6

interface OrderTableShellProps {
  sort: OrderSortField
  order: SortOrder
  onSort?: (field: OrderSortField) => void
  children: ReactNode
}

/** Khung bảng + header sắp xếp; dùng chung cho bảng thật và skeleton. */
export function OrderTableShell({ sort, order, onSort, children }: OrderTableShellProps) {
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Mã đơn</Table.Th>
            <Table.Th scope="col">Khách hàng</Table.Th>
            <Table.Th scope="col">Trạng thái</Table.Th>
            <SortableTh
              field="total"
              label="Tổng tiền"
              align="right"
              sort={sort}
              order={order}
              onSort={onSort}
            />
            <SortableTh
              field="created_at"
              label="Ngày tạo"
              sort={sort}
              order={order}
              onSort={onSort}
            />
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

interface OrderTableProps extends Omit<OrderTableShellProps, 'children'> {
  orders: Order[]
  onTransition: (order: Order, to: OrderTransitionTarget) => void
  /** Đơn đang chạy thao tác → hiện loading ở dòng đó. */
  busyOrderId: string | null
}

export function OrderTable({ orders, onTransition, busyOrderId, ...shell }: OrderTableProps) {
  return (
    <OrderTableShell {...shell}>
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          busy={busyOrderId === order.id}
          onTransition={onTransition}
        />
      ))}
    </OrderTableShell>
  )
}

interface OrderRowProps {
  order: Order
  busy: boolean
  onTransition: OrderTableProps['onTransition']
}

function OrderRow({ order, busy, onTransition }: OrderRowProps) {
  // Chỉ liệt kê thao tác hợp lệ theo state machine.
  const targets = getNextStatuses(order.status).filter(
    (status): status is OrderTransitionTarget => status !== 'pending',
  )
  return (
    <Table.Tr>
      <Table.Td>
        <Anchor component={Link} to={orderDetailPath(order.id)} size="sm" fw={500} ff="monospace">
          {order.code}
        </Anchor>
      </Table.Td>
      <Table.Td>
        <Stack gap={0}>
          <Text size="sm" truncate maw={240}>
            {order.customer_name}
          </Text>
          {order.customer_phone && (
            <Text size="xs" c="dimmed">
              {order.customer_phone}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <OrderStatusBadge status={order.status} />
      </Table.Td>
      <Table.Td ta="right" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <Text size="sm">{formatCurrency(order.total)}</Text>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" c="dimmed">
          {formatDateTime(order.created_at)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-end">
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                loading={busy}
                aria-label={`Thao tác cho đơn ${order.code}`}
              >
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                component={Link}
                to={orderDetailPath(order.id)}
                leftSection={<IconEye size={16} />}
              >
                Xem chi tiết
              </Menu.Item>
              {targets.length > 0 && <Menu.Divider />}
              {targets.map((to) => (
                <Menu.Item
                  key={to}
                  color={to === 'cancelled' ? 'red' : undefined}
                  onClick={() => onTransition(order, to)}
                >
                  {ORDER_ACTIONS[to].label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}
