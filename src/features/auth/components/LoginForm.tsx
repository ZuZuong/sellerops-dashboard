import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Anchor, Button, Group, PasswordInput, Stack, TextInput } from '@mantine/core'
import { isAuthError } from '@supabase/supabase-js'
import { IconAlertCircle } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { isDemoEnabled } from '@/shared/lib/demo/demoSession'
import { useSignIn } from '../api/auth.queries'
import { getAuthErrorMessage } from '../lib/authErrors'
import { loginSchema, type LoginInput } from '../schemas/login.schema'
import { DemoAccountsPanel } from './DemoAccountsPanel'
import type { VerifyEmailState } from './VerifyEmailNotice'

export function LoginForm() {
  const signIn = useSignIn()
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Điều hướng sau khi đăng nhập do GuestRoute xử lý khi phiên thay đổi.
  const onSubmit = (values: LoginInput) => signIn.mutate(values)
  const emailNotConfirmed = isAuthError(signIn.error) && signIn.error.code === 'email_not_confirmed'
  const verifyState: VerifyEmailState = { email: getValues('email') }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Đăng nhập">
      <Stack gap="md">
        {signIn.isError && (
          <Alert color="red" icon={<IconAlertCircle size={18} aria-hidden />} role="alert">
            {getAuthErrorMessage(signIn.error)}
            {emailNotConfirmed && (
              <>
                {' '}
                <Anchor component={Link} to={ROUTES.verifyEmail} state={verifyState} size="sm">
                  Gửi lại thư xác minh
                </Anchor>
              </>
            )}
          </Alert>
        )}
        <TextInput
          label="Email"
          description={isDemoEnabled() ? 'Hoặc tên tài khoản demo bên dưới' : undefined}
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="ban@cuahang.vn"
          withAsterisk
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Mật khẩu"
          autoComplete="current-password"
          withAsterisk
          error={errors.password?.message}
          {...register('password')}
        />
        <Group justify="flex-end" mt={-6}>
          <Anchor component={Link} to={ROUTES.forgotPassword} size="sm">
            Quên mật khẩu?
          </Anchor>
        </Group>
        <Button type="submit" fullWidth loading={signIn.isPending}>
          Đăng nhập
        </Button>
        {isDemoEnabled() && (
          <DemoAccountsPanel
            disabled={signIn.isPending}
            onSignIn={(email, password) => signIn.mutate({ email, password })}
          />
        )}
      </Stack>
    </form>
  )
}
