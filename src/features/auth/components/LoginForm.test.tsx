import { AuthApiError } from '@supabase/supabase-js'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { signIn } from '../api/auth.api'
import { LoginForm } from './LoginForm'

vi.mock('../api/auth.api', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  subscribeToAuthChanges: vi.fn(),
}))

const signInMock = vi.mocked(signIn)

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup()
  if (email) await user.type(screen.getByLabelText(/email/i), email)
  if (password) await user.type(screen.getByLabelText(/mật khẩu/i), password)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    signInMock.mockReset()
  })

  it('hiện lỗi validate và không gọi API khi bỏ trống', async () => {
    renderWithProviders(<LoginForm />)
    await fillAndSubmit('', '')

    expect(await screen.findByText('Vui lòng nhập email')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('báo email sai định dạng', async () => {
    renderWithProviders(<LoginForm />)
    await fillAndSubmit('not-an-email', 'secret')

    expect(await screen.findByText('Email không hợp lệ')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('gửi email đã cắt khoảng trắng và mật khẩu', async () => {
    signInMock.mockResolvedValue({} as Awaited<ReturnType<typeof signIn>>)
    renderWithProviders(<LoginForm />)
    await fillAndSubmit('  shop@example.com ', 'secret')

    await vi.waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1))
    expect(signInMock.mock.calls[0]?.[0]).toEqual({ email: 'shop@example.com', password: 'secret' })
  })

  it('hiện thông báo tiếng Việt khi sai thông tin đăng nhập', async () => {
    signInMock.mockRejectedValue(new AuthApiError('Invalid login', 400, 'invalid_credentials'))
    renderWithProviders(<LoginForm />)
    await fillAndSubmit('shop@example.com', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.')
  })
})
