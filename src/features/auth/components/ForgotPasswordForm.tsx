import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Stack, TextInput } from '@mantine/core'
import { IconMailCheck } from '@tabler/icons-react'
import { useForm } from 'react-hook-form'
import { useRequestPasswordReset } from '../api/auth.queries'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas/register.schema'

/** Thông báo cố định — không tiết lộ email có tài khoản hay không. */
export const RESET_REQUESTED_MESSAGE =
  'Nếu email này đã đăng ký tài khoản, bạn sẽ nhận được thư hướng dẫn đặt lại mật khẩu trong vài phút. Hãy kiểm tra cả mục Spam.'

export function ForgotPasswordForm() {
  const request = useRequestPasswordReset()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  if (request.isSuccess) {
    return (
      <Alert color="blue" icon={<IconMailCheck size={18} aria-hidden />} role="status">
        {RESET_REQUESTED_MESSAGE}
      </Alert>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(({ email }) => request.mutate(email))}
      noValidate
      aria-label="Quên mật khẩu"
    >
      <Stack gap="md">
        <TextInput
          label="Email đăng nhập"
          type="email"
          autoComplete="email"
          withAsterisk
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" fullWidth loading={request.isPending}>
          Gửi link đặt lại mật khẩu
        </Button>
      </Stack>
    </form>
  )
}
