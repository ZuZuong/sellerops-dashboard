import { useState } from 'react'
import { useTransitionOrder, type TransitionVariables } from '../api/orders.queries'
import { ORDER_ACTIONS, type OrderTransitionTarget } from '../domain/orderStatus'

export interface PendingTransition extends TransitionVariables {
  to: OrderTransitionTarget
}

/**
 * Điều phối một thao tác chuyển trạng thái: thao tác tác động kho / không hoàn tác được
 * (xác nhận, hủy) mở hộp thoại xác nhận trước; thao tác còn lại (giao hàng, đã giao) chạy luôn.
 */
export function useOrderTransitionFlow() {
  const mutation = useTransitionOrder()
  const [pending, setPending] = useState<PendingTransition | null>(null)

  const request = (variables: PendingTransition) => {
    if (ORDER_ACTIONS[variables.to].requiresConfirm) setPending(variables)
    else mutation.mutate(variables)
  }

  const confirm = () => {
    if (!pending) return
    mutation.mutate(pending, { onSettled: () => setPending(null) })
  }

  const cancel = () => {
    if (!mutation.isPending) setPending(null)
  }

  /** Đơn đang được xử lý (để hiện loading đúng nút / đúng dòng). */
  const runningOrderId = mutation.isPending ? mutation.variables.order.id : null
  const runningTarget = mutation.isPending ? mutation.variables.to : null

  return {
    request,
    pending,
    confirm,
    cancel,
    isRunning: mutation.isPending,
    runningOrderId,
    runningTarget,
  }
}

export type OrderTransitionFlow = ReturnType<typeof useOrderTransitionFlow>
