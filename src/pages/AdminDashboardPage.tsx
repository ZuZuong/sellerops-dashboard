import { AdminOverview, AdminPageHeader } from '@/features/admin'

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader
        title="Tổng quan"
        description="Số liệu toàn nền tảng, hồ sơ cần xử lý và hoạt động gần đây."
      />
      <AdminOverview />
    </>
  )
}
