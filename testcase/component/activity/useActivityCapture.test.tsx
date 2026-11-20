import { notifications } from '@mantine/notifications'
import { act, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { change, withChanges } from '@/shared/lib/activityChanges'
import { renderWithProviders } from '@test/render'
import { insertActivityLog } from '@/features/activity/api/activity.api'
import { ACTIVITY_SKIP_ATTR } from '@/features/activity/lib/activity'
import { useActivityCapture } from '@/features/activity/hooks/useActivityCapture'

vi.mock('@/features/activity/api/activity.api', () => ({
  insertActivityLog: vi.fn(() => Promise.resolve()),
}))

function Capture() {
  useActivityCapture()
  return null
}

afterEach(() => {
  act(() => notifications.clean())
  vi.mocked(insertActivityLog).mockClear()
})

describe('useActivityCapture', () => {
  it('ghi mỗi toast mới một lần, kèm trang hiện tại; bỏ qua toast có cờ skip', async () => {
    renderWithProviders(<Capture />, { route: '/seller/orders/abc' })

    act(() => {
      notifications.show({
        color: 'green',
        title: 'Đã tạo đơn hàng',
        message: 'Đơn của An',
        ...withChanges([change('Khách hàng', null, 'An'), change('Giữ nguyên', 'x', 'x')]),
      })
      notifications.show({ title: 'Bỏ qua', message: 'x', [ACTIVITY_SKIP_ATTR]: true })
    })

    await waitFor(() => expect(insertActivityLog).toHaveBeenCalledTimes(1))
    expect(insertActivityLog).toHaveBeenCalledWith({
      level: 'success',
      title: 'Đã tạo đơn hàng',
      message: 'Đơn của An',
      path: '/seller/orders/abc',
      changes: [{ field: 'Khách hàng', from: null, to: 'An' }],
    })
  })
})
