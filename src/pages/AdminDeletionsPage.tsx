import { DeletionsView, AdminPageHeader } from '@/features/admin'

export default function AdminDeletionsPage() {
  return (
    <>
      <AdminPageHeader
        title="Chờ xóa"
        description="Thùng rác tài khoản: khôi phục được bất cứ lúc nào. Email chỉ được giải phóng (đăng ký lại thành tài khoản mới) sau khi bấm Xóa vĩnh viễn; dữ liệu shop luôn được lưu giữ."
        crumbs={[{ label: 'Chờ xóa' }]}
      />
      <DeletionsView />
    </>
  )
}
