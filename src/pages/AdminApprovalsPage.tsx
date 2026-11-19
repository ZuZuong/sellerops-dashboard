import { ApprovalsView, AdminPageHeader } from '@/features/admin'

export default function AdminApprovalsPage() {
  return (
    <>
      <AdminPageHeader
        title="Duyệt hồ sơ"
        description="Hồ sơ đăng ký kinh doanh đang chờ xét duyệt, gửi sớm nhất lên trước."
        crumbs={[{ label: 'Duyệt hồ sơ' }]}
      />
      <ApprovalsView />
    </>
  )
}
