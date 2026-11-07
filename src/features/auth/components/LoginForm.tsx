import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { useSignIn } from '../api/auth.queries'
import { getAuthErrorMessage } from '../lib/authErrors'
import { loginSchema, type LoginInput } from '../schemas/login.schema'

export function LoginForm() {
  const signIn = useSignIn()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Điều hướng sau khi đăng nhập do GuestRoute xử lý khi phiên thay đổi.
  const onSubmit = (values: LoginInput) => signIn.mutate(values)

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Đăng nhập">
      <Stack gap="md">
        {signIn.isError && (
          <Alert color="red" icon={<IconAlertCircle size={18} aria-hidden />} role="alert">
            {getAuthErrorMessage(signIn.error)}
          </Alert>
        )}
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
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
        <Button type="submit" fullWidth loading={signIn.isPending}>
          Đăng nhập
        </Button>
      </Stack>
    </form>
  )
}
