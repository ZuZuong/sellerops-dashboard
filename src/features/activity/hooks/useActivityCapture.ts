import { notificationsStore } from '@mantine/notifications'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useLogActivity } from '../api/activity.queries'
import { toActivityInput } from '../lib/activity'

/**
 * Ghi mọi thông báo app hiển thị vào nhật ký hoạt động — một điểm duy nhất, không phải sửa từng
 * chỗ gọi `notifications.show`. Gắn ở layout đã đăng nhập.
 */
export function useActivityCapture() {
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  const logActivity = useLogActivity()
  const logRef = useRef(logActivity.mutate)

  useEffect(() => {
    pathRef.current = pathname
    logRef.current = logActivity.mutate
  })

  useEffect(() => {
    // Toast đang hiện lúc gắn (vd. trước khi đăng nhập xong) không ghi lại.
    const seen = new Set<string>()
    const remember = (ids: Iterable<string | undefined>) => {
      for (const id of ids) if (id) seen.add(id)
    }
    const initial = notificationsStore.getState()
    remember([...initial.notifications, ...initial.queue].map((n) => n.id))

    return notificationsStore.subscribe((state) => {
      for (const notification of [...state.notifications, ...state.queue]) {
        if (!notification.id || seen.has(notification.id)) continue
        seen.add(notification.id)
        const input = toActivityInput(notification, pathRef.current)
        if (input) logRef.current(input)
      }
    })
  }, [])
}
