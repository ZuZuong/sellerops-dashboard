import { AuthApiError, type Session } from '@supabase/supabase-js'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@test/render'
import { requestPasswordReset, signUp, updatePassword } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/hooks/useAuth'
import { captureAuthRedirect, resetAuthRedirect } from '@/features/auth/lib/authRedirect'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'

vi.mock('@/features/auth/api/auth.api', () => ({
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  resendVerificationEmail: vi.fn(),
  signOut: vi.fn(),
  subscribeToAuthChanges: vi.fn(),
}))

const api = {
  signUp: vi.mocked(signUp),
  requestPasswordReset: vi.mocked(requestPasswordReset),
  updatePassword: vi.mocked(updatePassword),
}

const fakeSession = { user: { id: 'u1', email: 'shop@example.com' } } as Session

function Probe() {
  const { pathname, state } = useLocation()
  return <p>{`at ${pathname} ${JSON.stringify(state)}`}</p>
}

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  resetAuthRedirect()
  useAuthStore.setState({ status: 'unauthenticated', session: null, recovery: false })
})

describe('RegisterForm', () => {
  it('validate mật khẩu tối thiểu 8 ký tự và nhập lại khớp', async () => {
    renderWithProviders(<RegisterForm />, { route: '/register' })
    await userEvent.type(screen.getByLabelText(/Họ và tên/), 'Nguyễn Văn A')
    await userEvent.type(screen.getByLabelText(/^Email/), 'shop@example.com')
    await userEvent.type(screen.getByLabelText(/^Mật khẩu/), '1234567')
    await userEvent.type(screen.getByLabelText(/Nhập lại mật khẩu/), '7654321')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }))

    expect(await screen.findByText('Mật khẩu tối thiểu 8 ký tự')).toBeInTheDocument()
    expect(screen.getByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument()
    expect(api.signUp).not.toHaveBeenCalled()
  })

  it('đăng ký xong → sang trang "đã gửi thư xác minh" kèm email', async () => {
    api.signUp.mockResolvedValue()
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/verify-email" element={<Probe />} />
      </Routes>,
      { route: '/register' },
    )
    await userEvent.type(screen.getByLabelText(/Họ và tên/), 'Nguyễn Văn A')
    await userEvent.type(screen.getByLabelText(/^Email/), 'shop@example.com')
    await userEvent.type(screen.getByLabelText(/^Mật khẩu/), 'matkhau123')
    await userEvent.type(screen.getByLabelText(/Nhập lại mật khẩu/), 'matkhau123')
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }))

    expect(
      await screen.findByText('at /verify-email {"email":"shop@example.com"}'),
    ).toBeInTheDocument()
    expect(api.signUp.mock.calls[0]?.[0]).toEqual({
      fullName: 'Nguyễn Văn A',
      email: 'shop@example.com',
      password: 'matkhau123',
      confirmPassword: 'matkhau123',
    })
  })
})

describe('ForgotPasswordForm', () => {
  const submit = async (email: string) => {
    renderWithProviders(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText(/Email đăng nhập/), email)
    await userEvent.click(screen.getByRole('button', { name: 'Gửi link đặt lại mật khẩu' }))
  }

  it('thông báo giống nhau dù email có tồn tại hay không', async () => {
    api.requestPasswordReset.mockResolvedValue()
    await submit('co-tai-khoan@example.com')
    const shown = (await screen.findByRole('status')).textContent

    api.requestPasswordReset.mockRejectedValue(
      new AuthApiError('User not found', 400, 'user_not_found'),
    )
    document.body.innerHTML = ''
    await submit('khong-co@example.com')
    expect((await screen.findByRole('status')).textContent).toBe(shown)
  })

  it('lỗi giới hạn tần suất thì báo để người dùng biết chờ', async () => {
    api.requestPasswordReset.mockRejectedValue(
      new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'),
    )
    await submit('a@example.com')
    await waitFor(() => expect(api.requestPasswordReset).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi link đặt lại mật khẩu' })).toBeInTheDocument()
  })
})

describe('ResetPasswordForm', () => {
  it('mở trực tiếp (không có phiên khôi phục) → báo link không hợp lệ', () => {
    renderWithProviders(<ResetPasswordForm />, { route: '/reset-password' })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
    )
    expect(screen.getByRole('link', { name: 'Gửi lại link đặt lại mật khẩu' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('link hết hạn → báo rõ lý do', () => {
    captureAuthRedirect({ hash: '#error=access_denied&error_code=otp_expired', search: '' })
    renderWithProviders(<ResetPasswordForm />, { route: '/reset-password' })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Link trong thư đã hết hạn hoặc đã được dùng',
    )
  })

  it('có phiên khôi phục → đặt mật khẩu mới', async () => {
    api.updatePassword.mockResolvedValue()
    useAuthStore.setState({ status: 'authenticated', session: fakeSession, recovery: true })
    renderWithProviders(
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/" element={<Probe />} />
      </Routes>,
      { route: '/reset-password' },
    )
    await userEvent.type(screen.getByLabelText(/^Mật khẩu mới/), 'matkhaumoi1')
    await userEvent.type(screen.getByLabelText(/Nhập lại mật khẩu mới/), 'matkhaumoi1')
    await userEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }))

    await waitFor(() => expect(api.updatePassword.mock.calls[0]?.[0]).toBe('matkhaumoi1'))
    expect(await screen.findByText(/^at \//)).toBeInTheDocument()
    expect(useAuthStore.getState().recovery).toBe(false)
  })
})
