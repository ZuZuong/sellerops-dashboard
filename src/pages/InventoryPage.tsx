import { InventoryView } from '@/features/inventory'
import { PageHeader } from '@/shared/components/PageHeader'

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Kho hàng"
        description="Tồn kho, cảnh báo sắp hết hàng, điều chỉnh kho và lịch sử biến động."
      />
      <InventoryView />
    </>
  )
}
