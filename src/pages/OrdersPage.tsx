import { CreateOrderButton, OrdersView } from '@/features/orders'
import { PageHeader } from '@/shared/components/PageHeader'

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description="Theo dõi và xử lý đơn hàng."
        actions={<CreateOrderButton />}
      />
      <OrdersView />
    </>
  )
}
