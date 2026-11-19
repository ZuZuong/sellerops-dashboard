import { notifications } from '@mantine/notifications'
import type { User } from '@supabase/supabase-js'
import { queryOptions, useMutation, useQuery, type QueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '../hooks/useAuth'
import { getAuthErrorMessage, isDisclosableResetError } from '../lib/authErrors'
import {
  fetchAccount,
  getSessionUser,
  requestPasswordReset,
  resendVerificationEmail,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from './auth.api'

export const authKeys = {
  all: ['auth'] as const,
  account: (userId: string) => [...authKeys.all, 'account', userId] as const,
}

/**
 * Tài khoản đang đăng nhập (role, khóa) từ bảng `profiles`. Mọi guard dùng chung query này.
 * Không tự retry khi lỗi: màn hình lỗi có nút "Thử lại".
 */
const accountQuery = (user: User) =>
  queryOptions({
    queryKey: authKeys.account(user.id),
    queryFn: () => fetchAccount(user),
    staleTime: 5 * 60_000,
    // Dự phòng khi Realtime mất kết nối: quay lại tab là kiểm tra lại trạng thái tài khoản.
    refetchOnWindowFocus: true,
    retry: false,
  })

export function useAccount() {
  const user = useCurrentUser()
  return useQuery({
    ...(user
      ? accountQuery(user)
      : {
          queryKey: authKeys.account('anonymous'),
          queryFn: () => Promise.reject(new Error('NOT_AUTHENTICATED')),
        }),
    enabled: user !== null,
  })
}

/**
 * Bắt đầu tải tài khoản ngay khi điều hướng (route loader), song song với việc tải code trang,
 * thay vì đợi component render xong mới gọi. Không chặn điều hướng; dùng cache nếu còn mới.
 */
export async function prefetchAccount(queryClient: QueryClient): Promise<void> {
  const user = await getSessionUser()
  if (user) await queryClient.prefetchQuery(accountQuery(user))
}

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
    // Lỗi còn hiển thị ngay trong form (kèm nút gửi lại thư nếu email chưa xác minh).
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

/**
 * Đăng xuất do hệ thống (tài khoản bị xóa): không hiện toast "Hẹn gặp lại" — trang đăng nhập
 * hiển thị lý do. Lỗi mạng khi đăng xuất vẫn xóa phiên cục bộ (Supabase luôn xóa local session).
 */
export function useForceSignOut() {
  return useMutation({ mutationFn: signOut })
}

export function useSignUp() {
  return useMutation({
    mutationFn: signUp,
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Đăng ký thất bại',
        message: getAuthErrorMessage(error),
      })
    },
  })
}

export function useResendVerification() {
  return useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: () => {
      notifications.show({
        color: 'green',
        title: 'Đã gửi lại thư xác minh',
        message: 'Vui lòng kiểm tra hộp thư (kể cả mục Spam).',
      })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không gửi lại được thư',
        message: getAuthErrorMessage(error),
      })
    },
  })
}

/**
 * Quên mật khẩu: kết quả hiển thị LUÔN giống nhau dù email có tồn tại hay không. Chỉ lỗi mạng /
 * giới hạn tần suất mới báo lỗi (`isDisclosableResetError`) — các lỗi khác coi như đã gửi.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      try {
        await requestPasswordReset(email)
      } catch (error) {
        if (isDisclosableResetError(error)) throw error
      }
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không gửi được yêu cầu',
        message: getAuthErrorMessage(error),
      })
    },
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      notifications.show({
        color: 'green',
        title: 'Đã đổi mật khẩu',
        message: 'Từ lần sau hãy đăng nhập bằng mật khẩu mới.',
      })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không đổi được mật khẩu',
        message: getAuthErrorMessage(error),
      })
    },
  })
}
