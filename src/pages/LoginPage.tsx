import { Alert, Anchor } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { Link } from 'react-router'
import {
  AuthCard,
  getAuthRedirect,
  getRedirectErrorMessage,
  LoginForm,
  useSignOutReason,
} from '@/features/auth'
import { ROUTES } from '@/shared/constants/routes'

export default function LoginPage() {
  // Link xác minh email hết hạn / đã dùng → Supabase quay về đây kèm mã lỗi.
  const redirectError = getAuthRedirect().errorCode
  const signOutReason = useSignOutReason()

  return (
    <AuthCard
      title="Đăng nhập"
      description="Quản lý sản phẩm, đơn hàng và tồn kho của cửa hàng."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Anchor component={Link} to={ROUTES.register} size="sm">
            Đăng ký bán hàng
          </Anchor>
        </>
      }
    >
      {signOutReason === 'account_removed' && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} aria-hidden />}
          role="alert"
          title="Tài khoản đã bị xóa"
        >
          Tài khoản của bạn đã bị quản trị viên xóa khỏi nền tảng. Lý do và hướng dẫn khiếu nại đã
          được gửi tới email đăng ký của bạn.
        </Alert>
      )}
      {redirectError && (
        <Alert color="orange" icon={<IconAlertCircle size={18} aria-hidden />} role="alert">
          {getRedirectErrorMessage(redirectError)} Hãy đăng nhập để được gửi lại thư xác minh.
        </Alert>
      )}
      <LoginForm />
    </AuthCard>
  )
}
