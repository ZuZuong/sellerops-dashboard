import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { getAuthErrorMessage } from '../lib/authErrors'
import { signIn, signOut } from './auth.api'

export function useSignIn() {
  return useMutation({
    mutationFn: signIn,
    onSuccess: () => {
      notifications.show({
        color: 'green',
        title: 'Đăng nhập thành công',
        message: 'Chào mừng trở lại!',
      })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Đăng nhập thất bại',
        message: getAuthErrorMessage(error),
      })
    },
  })
}

export function useSignOut() {
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      notifications.show({ color: 'green', title: 'Đã đăng xuất', message: 'Hẹn gặp lại!' })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Đăng xuất thất bại',
        message: getAuthErrorMessage(error),
      })
    },
  })
}
