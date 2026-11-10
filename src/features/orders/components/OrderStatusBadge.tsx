import { Badge } from '@mantine/core'
import { ORDER_STATUS_META, type OrderStatus } from '../domain/orderStatus'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, color } = ORDER_STATUS_META[status]
  return (
    <Badge color={color} variant="light" radius="sm">
      {label}
    </Badge>
  )
}
