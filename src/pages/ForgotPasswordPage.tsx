import { Anchor } from '@mantine/core'
import { Link } from 'react-router'
import { AuthCard, ForgotPasswordForm } from '@/features/auth'
import { ROUTES } from '@/shared/constants/routes'

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Quên mật khẩu"
      description="Nhập email đăng nhập, chúng tôi sẽ gửi link đặt lại mật khẩu."
      footer={
        <Anchor component={Link} to={ROUTES.login} size="sm">
          Quay lại đăng nhập
        </Anchor>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
