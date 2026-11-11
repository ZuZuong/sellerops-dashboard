import { useParams } from 'react-router'
import { ReceiptDetailView } from '@/features/purchasing'

export default function PurchaseDetailPage() {
  const { receiptId = '' } = useParams()
  return <ReceiptDetailView key={receiptId} receiptId={receiptId} />
}
