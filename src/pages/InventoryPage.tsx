import { InventoryView } from '@/features/inventory'
import { CreateReceiptButton } from '@/features/purchasing'
import { PageHeader } from '@/shared/components/PageHeader'

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Kho hàng"
        description="Tồn kho, giá vốn, cảnh báo sắp hết hàng, điều chỉnh kho và lịch sử biến động."
        actions={<CreateReceiptButton />}
      />
      <InventoryView />
    </>
  )
}
