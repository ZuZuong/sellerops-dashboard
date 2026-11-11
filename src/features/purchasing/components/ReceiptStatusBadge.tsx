import { Badge } from '@mantine/core'
import { RECEIPT_STATUS_META, type ReceiptStatus } from '../domain/receiptStatus'

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const { label, color } = RECEIPT_STATUS_META[status]
  return (
    <Badge color={color} variant="light" radius="sm">
      {label}
    </Badge>
  )
}
