import { List, Stack, Text } from '@mantine/core'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatNumber } from '@/shared/lib/formatters'
import { getStockEffect, ORDER_ACTIONS } from '../domain/orderStatus'
import type { OrderTransitionFlow, PendingTransition } from '../hooks/useOrderTransitionFlow'

const TITLES: Partial<Record<PendingTransition['to'], string>> = {
  confirmed: 'Xác nhận đơn hàng?',
  cancelled: 'Hủy đơn hàng?',
}

function DialogMessage({ pending }: { pending: PendingTransition }) {
  const { order, to, items } = pending
  const effect = getStockEffect(order.status, to)

  const intro =
    effect === 'deduct'
      ? `Đơn ${order.code} sẽ được xác nhận và kho được trừ theo số lượng trong đơn. Nếu sản phẩm nào không đủ hàng, đơn sẽ không được xác nhận.`
      : effect === 'restock'
        ? `Đơn ${order.code} sẽ bị hủy và số lượng đã trừ được hoàn lại kho. Thao tác này không thể hoàn tác.`
        : `Đơn ${order.code} sẽ bị hủy. Kho không thay đổi vì đơn chưa được xác nhận. Thao tác này không thể hoàn tác.`

  return (
    <Stack gap="xs">
      <Text size="sm">{intro}</Text>
      {effect !== 'none' && items && items.length > 0 && (
        <List size="sm" spacing={4}>
          {items.map((item) => (
            <List.Item key={item.id}>
              {item.product?.name ?? 'Sản phẩm đã xóa'}: {effect === 'deduct' ? '−' : '+'}
              {formatNumber(item.quantity)}
            </List.Item>
          ))}
        </List>
      )}
    </Stack>
  )
}

/** Hộp thoại xác nhận cho thao tác xác nhận / hủy đơn (nêu rõ tác động lên kho). */
export function OrderTransitionDialog({ flow }: { flow: OrderTransitionFlow }) {
  const { pending } = flow
  return (
    <ConfirmDialog
      opened={pending !== null}
      title={pending ? (TITLES[pending.to] ?? ORDER_ACTIONS[pending.to].label) : ''}
      message={pending ? <DialogMessage pending={pending} /> : ''}
      confirmLabel={pending ? ORDER_ACTIONS[pending.to].label : ''}
      cancelLabel="Quay lại"
      color={pending ? ORDER_ACTIONS[pending.to].color : undefined}
      loading={flow.isRunning}
      onConfirm={flow.confirm}
      onClose={flow.cancel}
    />
  )
}
