import { Anchor, Button, Skeleton, Table, Text } from '@mantine/core'
import { IconReceipt } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { OrderStatusBadge } from '@/features/orders'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { WidgetCard } from '@/shared/components/WidgetCard'
import { ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters'
import { useRecentOrders } from '../api/dashboard.queries'

const LIMIT = 5

export function RecentOrders() {
  return (
    <WidgetCard
      title="Đơn hàng gần đây"
      actions={
        <Anchor component={Link} to={ROUTES.orders} size="sm">
          Xem tất cả
        </Anchor>
      }
    >
      <RecentOrdersContent />
    </WidgetCard>
  )
}

function RecentOrdersContent() {
  const { data, isPending, isError, error, refetch, isRefetching } = useRecentOrders(LIMIT)

  if (isPending) {
    return (
      <Table.ScrollContainer minWidth={560} aria-busy data-testid="recent-orders-skeleton">
        <OrdersTable>
          {Array.from({ length: LIMIT }, (_, i) => (
            <Table.Tr key={i}>
              {Array.from({ length: 5 }, (_, j) => (
                <Table.Td key={j}>
                  <Skeleton height={14} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </OrdersTable>
      </Table.ScrollContainer>
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
        icon={<IconReceipt size={24} stroke={1.5} />}
        title="Chưa có đơn hàng nào"
        description="Tạo đơn hàng đầu tiên để bắt đầu theo dõi doanh thu."
        action={
          <Button component={Link} to={ROUTES.orders} size="xs" variant="light">
            Đến trang đơn hàng
          </Button>
        }
      />
    )
  }

  return (
    <Table.ScrollContainer minWidth={560}>
      <OrdersTable>
        {data.map((order) => (
          <Table.Tr key={order.id}>
            <Table.Td>
              <Text size="sm" fw={500} ff="monospace">
                {order.code}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" truncate maw={220}>
                {order.customer_name}
              </Text>
            </Table.Td>
            <Table.Td>
              <OrderStatusBadge status={order.status} />
            </Table.Td>
            <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
              {formatCurrency(order.total)}
            </Table.Td>
            <Table.Td style={{ whiteSpace: 'nowrap' }}>
              <Text size="sm" c="dimmed">
                {formatDateTime(order.created_at)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </OrdersTable>
    </Table.ScrollContainer>
  )
}

function OrdersTable({ children }: { children: ReactNode }) {
  return (
    <Table verticalSpacing="sm" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th scope="col">Mã đơn</Table.Th>
          <Table.Th scope="col">Khách hàng</Table.Th>
          <Table.Th scope="col">Trạng thái</Table.Th>
          <Table.Th scope="col" ta="right">
            Tổng tiền
          </Table.Th>
          <Table.Th scope="col">Thời gian</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{children}</Table.Tbody>
    </Table>
  )
}
