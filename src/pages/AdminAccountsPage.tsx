import { AccountsView, AdminPageHeader } from '@/features/admin'

export default function AdminAccountsPage() {
  return (
    <>
      <AdminPageHeader
        title="Tài khoản"
        description="Tìm kiếm, khóa / mở khóa và xóa tài khoản người dùng."
        crumbs={[{ label: 'Tài khoản' }]}
      />
      <AccountsView />
    </>
  )
}
