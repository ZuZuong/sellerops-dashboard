import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, PasswordInput, Stack } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { PageLoader } from '@/shared/components/PageLoader'
import { ROUTES } from '@/shared/constants/routes'
import { useUpdatePassword } from '../api/auth.queries'
import { useAuthStatus, useAuthStore, useIsRecoverySession } from '../hooks/useAuth'
import { getRedirectErrorMessage } from '../lib/authErrors'
import { getAuthRedirect } from '../lib/authRedirect'
import {
  PASSWORD_MIN,
  passwordPairSchema,
  type PasswordPairInput,
} from '../schemas/password.schema'

/**
 * Trang mở từ link "đặt lại mật khẩu" trong thư. Supabase tạo phiên khôi phục từ token trên URL;
 * chỉ khi có phiên đó mới cho đặt mật khẩu mới. Link hết hạn / đã dùng / mở trực tiếp → báo lỗi
 * và gợi ý gửi lại thư.
 */
export function ResetPasswordForm() {
  const status = useAuthStatus()
  const isRecovery = useIsRecoverySession()
  const update = useUpdatePassword()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordPairInput>({
    resolver: zodResolver(passwordPairSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  if (status === 'loading') return <PageLoader />

  const redirectError = getAuthRedirect().errorCode
  if (!isRecovery || redirectError) {
    return (
      <Stack gap="md">
        <Alert color="red" icon={<IconAlertCircle size={18} aria-hidden />} role="alert">
          {redirectError
            ? getRedirectErrorMessage(redirectError)
            : 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'}{' '}
          Hãy yêu cầu gửi link mới.
        </Alert>
        <Button component={Link} to={ROUTES.forgotPassword} fullWidth>
          Gửi lại link đặt lại mật khẩu
        </Button>
        <Anchor component={Link} to={ROUTES.login} size="sm" ta="center">
          Quay lại đăng nhập
        </Anchor>
      </Stack>
    )
  }

  const onSubmit = ({ password }: PasswordPairInput) =>
    update.mutate(password, {
      onSuccess: () => {
        useAuthStore.getState().setRecovery(false)
        navigate(ROUTES.home, { replace: true })
      },
    })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Đặt lại mật khẩu">
      <Stack gap="md">
        <PasswordInput
          label="Mật khẩu mới"
          autoComplete="new-password"
          description={`Tối thiểu ${PASSWORD_MIN} ký tự`}
          withAsterisk
          data-autofocus
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          withAsterisk
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" fullWidth loading={update.isPending}>
          Đặt mật khẩu mới
        </Button>
      </Stack>
    </form>
  )
}
