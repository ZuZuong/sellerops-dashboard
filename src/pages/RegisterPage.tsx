import { Anchor } from '@mantine/core'
import { Link } from 'react-router'
import { AuthCard, RegisterForm } from '@/features/auth'
import { ROUTES } from '@/shared/constants/routes'

export default function RegisterPage() {
  return (
    <AuthCard
      title="Đăng ký bán hàng"
      description="Tạo tài khoản, xác minh email rồi hoàn tất hồ sơ kinh doanh để được duyệt."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Anchor component={Link} to={ROUTES.login} size="sm">
            Đăng nhập
          </Anchor>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  )
}
