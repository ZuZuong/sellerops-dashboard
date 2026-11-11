import { CreateReceiptButton, PurchasesView } from '@/features/purchasing'
import { PageHeader } from '@/shared/components/PageHeader'

export default function PurchasesPage() {
  return (
    <>
      <PageHeader
        title="Nhập hàng"
        description="Phiếu nhập kho từ nhà cung cấp: số lượng theo chứng từ, thực nhận, hàng lỗi và giá nhập."
        actions={<CreateReceiptButton />}
      />
      <PurchasesView />
    </>
  )
}
