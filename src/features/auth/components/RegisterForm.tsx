import { zodResolver } from '@hookform/resolvers/zod'
import { Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { useSignUp } from '../api/auth.queries'
import { PASSWORD_MIN } from '../schemas/password.schema'
import { registerSchema, type RegisterInput } from '../schemas/register.schema'
import type { VerifyEmailState } from './VerifyEmailNotice'

/** Đăng ký tài khoản seller bằng email + mật khẩu; xong chuyển sang màn hình "đã gửi thư". */
export function RegisterForm() {
  const signUp = useSignUp()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = (values: RegisterInput) =>
    signUp.mutate(values, {
      onSuccess: () => {
        const state: VerifyEmailState = { email: values.email }
        navigate(ROUTES.verifyEmail, { state })
      },
    })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Đăng ký">
      <Stack gap="md">
        <TextInput
          label="Họ và tên"
          autoComplete="name"
          withAsterisk
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ban@cuahang.vn"
          description="Dùng email thật: bạn cần xác minh qua thư và dùng nó khi quên mật khẩu."
          withAsterisk
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordInput
          label="Mật khẩu"
          autoComplete="new-password"
          description={`Tối thiểu ${PASSWORD_MIN} ký tự`}
          withAsterisk
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Nhập lại mật khẩu"
          autoComplete="new-password"
          withAsterisk
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" fullWidth loading={signUp.isPending}>
          Đăng ký
        </Button>
      </Stack>
    </form>
  )
}
