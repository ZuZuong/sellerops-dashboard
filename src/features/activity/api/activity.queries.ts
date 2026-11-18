import { notifications } from '@mantine/notifications'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '@/shared/lib/errors'
import { ACTIVITY_SKIP_ATTR } from '../lib/activity'
import type { ActivityInput } from '../types'
import {
  clearActivityLogs,
  fetchActivityLogs,
  fetchUnreadActivityCount,
  insertActivityLog,
  markAllActivityRead,
} from './activity.api'

export const activityKeys = {
  all: ['activity'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (limit: number) => [...activityKeys.lists(), limit] as const,
  unreadCount: () => [...activityKeys.all, 'unread-count'] as const,
}

export function useActivityLogs(limit: number) {
  return useQuery({
    queryKey: activityKeys.list(limit),
    queryFn: () => fetchActivityLogs(limit),
    placeholderData: keepPreviousData,
    // Mở chuông là lấy mới (dropdown mount lại mỗi lần mở).
    staleTime: 0,
  })
}

export function useUnreadActivityCount() {
  return useQuery({
    queryKey: activityKeys.unreadCount(),
    queryFn: fetchUnreadActivityCount,
    // Thông báo từ thiết bị / tab khác: làm mới định kỳ và khi quay lại tab.
    refetchInterval: 60_000,
  })
}

/** Ghi nhật ký im lặng: lỗi ghi log không được làm phiền người dùng hay chặn thao tác chính. */
export function useLogActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ActivityInput) => insertActivityLog(input),
    onSuccess: () => {
      queryClient.setQueryData<number>(activityKeys.unreadCount(), (count) => (count ?? 0) + 1)
      return queryClient.invalidateQueries({ queryKey: activityKeys.lists() })
    },
  })
}

export function useMarkAllActivityRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllActivityRead,
    onSuccess: () => queryClient.setQueryData(activityKeys.unreadCount(), 0),
  })
}

export function useClearActivityLogs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clearActivityLogs,
    onSuccess: () => {
      notifications.show({
        color: 'green',
        title: 'Đã xóa lịch sử thông báo',
        message: 'Toàn bộ nhật ký hoạt động đã được xóa.',
        [ACTIVITY_SKIP_ATTR]: true,
      })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Không xóa được lịch sử thông báo',
        message: getErrorMessage(error),
        [ACTIVITY_SKIP_ATTR]: true,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: activityKeys.all }),
  })
}
