import { AuditLogView, AdminPageHeader } from '@/features/admin'

export default function AdminAuditLogPage() {
  return (
    <>
      <AdminPageHeader
        title="Nhật ký"
        description="Mọi hành động của quản trị viên: duyệt, từ chối, khóa, xóa, khôi phục."
        crumbs={[{ label: 'Nhật ký' }]}
      />
      <AuditLogView />
    </>
  )
}
