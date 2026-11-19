import { Alert, Anchor, Button, Stack, Text } from '@mantine/core'
import { IconMailCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { useResendVerification } from '../api/auth.queries'

/** State điều hướng tới /verify-email (email vừa đăng ký, để gửi lại thư). */
export interface VerifyEmailState {
  email: string
}

/** Thời gian chờ giữa hai lần gửi lại (Supabase cũng giới hạn tần suất gửi thư). */
export const RESEND_COOLDOWN_SECONDS = 60

function readEmail(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('email' in state)) return null
  return typeof state.email === 'string' && state.email.includes('@') ? state.email : null
}

/** Thông báo đã gửi thư xác minh + nút gửi lại (có thời gian chờ). */
export function VerifyEmailNotice() {
  const email = readEmail(useLocation().state)
  const resend = useResendVerification()
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const handleResend = () => {
    if (!email) return
    resend.mutate(email, { onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS) })
  }

  return (
    <Stack gap="md">
      <Alert color="blue" icon={<IconMailCheck size={18} aria-hidden />} role="status">
        {email ? (
          <>
            Chúng tôi đã gửi thư xác minh tới <strong>{email}</strong>.
          </>
        ) : (
          'Chúng tôi đã gửi thư xác minh tới email bạn đăng ký.'
        )}{' '}
        Mở thư và bấm vào link để kích hoạt tài khoản, sau đó bạn sẽ được đưa vào trang hoàn tất hồ
        sơ shop.
      </Alert>
      <Text size="sm" c="dimmed">
        Không thấy thư? Kiểm tra mục Spam / Quảng cáo. Link trong thư chỉ dùng được một lần và có
        thời hạn.
      </Text>
      {email ? (
        <Button
          variant="light"
          onClick={handleResend}
          loading={resend.isPending}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Gửi lại thư sau ${cooldown} giây` : 'Gửi lại thư xác minh'}
        </Button>
      ) : null}
      <Anchor component={Link} to={ROUTES.login} size="sm" ta="center">
        Đã xác minh? Đăng nhập
      </Anchor>
    </Stack>
  )
}
