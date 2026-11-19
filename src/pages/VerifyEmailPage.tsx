import { AuthCard, VerifyEmailNotice } from '@/features/auth'

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Kiểm tra hộp thư của bạn">
      <VerifyEmailNotice />
    </AuthCard>
  )
}
