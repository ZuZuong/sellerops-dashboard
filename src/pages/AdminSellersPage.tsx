import { SellersView, AdminPageHeader } from '@/features/admin'

export default function AdminSellersPage() {
  return (
    <>
      <AdminPageHeader
        title="Shop"
        description="Danh sách shop trên nền tảng, tạm khóa / mở khóa shop."
        crumbs={[{ label: 'Shop' }]}
      />
      <SellersView />
    </>
  )
}
