import { useParams } from 'react-router'
import { OrderDetailView } from '@/features/orders'

export default function OrderDetailPage() {
  const { orderId = '' } = useParams()
  // key: chuyển sang đơn khác → reset state cục bộ (hộp thoại đang mở...).
  return <OrderDetailView key={orderId} orderId={orderId} />
}
