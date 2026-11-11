import { Button, Group } from '@mantine/core'
import { IconCheck, IconPackageExport, IconTruckDelivery, IconX } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { getNextStatuses, ORDER_ACTIONS, type OrderTransitionTarget } from '../domain/orderStatus'
import type { OrderTransitionFlow } from '../hooks/useOrderTransitionFlow'
import type { OrderDetail } from '../types'

const ICONS: Readonly<Record<OrderTransitionTarget, ReactNode>> = {
  confirmed: <IconCheck size={16} aria-hidden />,
  shipping: <IconTruckDelivery size={16} aria-hidden />,
  delivered: <IconPackageExport size={16} aria-hidden />,
  cancelled: <IconX size={16} aria-hidden />,
}

interface OrderStatusActionsProps {
  order: OrderDetail
  flow: OrderTransitionFlow
}

/**
 * Nút chuyển trạng thái theo state machine: chỉ hiện thao tác hợp lệ với trạng thái hiện tại
 * (đơn đã giao / đã hủy không có nút nào). Trong lúc một thao tác đang chạy, các nút khác bị khóa.
 */
export function OrderStatusActions({ order, flow }: OrderStatusActionsProps) {
  const targets = getNextStatuses(order.status).filter(
    (status): status is OrderTransitionTarget => status !== 'pending',
  )
  if (targets.length === 0) return null

  // Hủy đặt trước, thao tác chính (tiến tới bước sau) đặt cuối cùng bên phải.
  const ordered = [...targets].sort((a, b) => Number(b === 'cancelled') - Number(a === 'cancelled'))

  return (
    <Group gap="sm" wrap="wrap">
      {ordered.map((to) => {
        const meta = ORDER_ACTIONS[to]
        const running = flow.runningOrderId === order.id && flow.runningTarget === to
        return (
          <Button
            key={to}
            color={meta.color}
            variant={to === 'cancelled' ? 'light' : 'filled'}
            leftSection={ICONS[to]}
            loading={running}
            disabled={flow.isRunning && !running}
            onClick={() => flow.request({ order, to, items: order.items })}
          >
            {meta.label}
          </Button>
        )
      })}
    </Group>
  )
}
