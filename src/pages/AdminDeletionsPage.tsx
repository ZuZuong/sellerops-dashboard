import { DeletionsView, AdminPageHeader } from '@/features/admin'

export default function AdminDeletionsPage() {
  return (
    <>
      <AdminPageHeader
        title="Chờ xóa"
        description="Tài khoản bị xóa đang chờ xác nhận. Dữ liệu luôn được lưu giữ và có thể khôi phục."
        crumbs={[{ label: 'Chờ xóa' }]}
      />
      <DeletionsView />
    </>
  )
}
