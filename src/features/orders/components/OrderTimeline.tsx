import { Text, ThemeIcon, Timeline } from '@mantine/core'
import { IconCheck, IconCircleDashed, IconX } from '@tabler/icons-react'
import { formatDateTime } from '@/shared/lib/formatters'
import { ORDER_STATUS_META } from '../domain/orderStatus'
import { buildOrderTimeline } from '../domain/orderTimeline'
import type { OrderDetail } from '../types'

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const steps = buildOrderTimeline(order.status, order.events, order.created_at)
  const active = steps.reduce((last, step, index) => (step.done ? index : last), 0)

  return (
    <Timeline active={active} bulletSize={24} lineWidth={2} aria-label="Lịch sử trạng thái">
      {steps.map((step) => {
        const cancelled = step.status === 'cancelled'
        return (
          <Timeline.Item
            key={step.status}
            color={cancelled ? 'red' : undefined}
            bullet={
              <ThemeIcon
                size={24}
                radius="xl"
                color={cancelled ? 'red' : step.done ? undefined : 'gray'}
                variant={step.done ? 'filled' : 'light'}
              >
                {cancelled ? (
                  <IconX size={14} aria-hidden />
                ) : step.done ? (
                  <IconCheck size={14} aria-hidden />
                ) : (
                  <IconCircleDashed size={14} aria-hidden />
                )}
              </ThemeIcon>
            }
            title={ORDER_STATUS_META[step.status].label}
          >
            <Text size="xs" c="dimmed">
              {step.at ? formatDateTime(step.at) : 'Chưa tới bước này'}
            </Text>
          </Timeline.Item>
        )
      })}
    </Timeline>
  )
}
