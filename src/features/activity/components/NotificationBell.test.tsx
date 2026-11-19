import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  clearActivityLogs,
  fetchActivityLogs,
  fetchUnreadActivityCount,
  markAllActivityRead,
} from '../api/activity.api'
import type { ActivityLog } from '../types'
import { NotificationBell } from './NotificationBell'

vi.mock('../api/activity.api', () => ({
  fetchActivityLogs: vi.fn(),
  fetchUnreadActivityCount: vi.fn(),
  insertActivityLog: vi.fn(),
  markAllActivityRead: vi.fn(),
  clearActivityLogs: vi.fn(),
}))

const api = {
  fetchActivityLogs: vi.mocked(fetchActivityLogs),
  fetchUnreadActivityCount: vi.mocked(fetchUnreadActivityCount),
  markAllActivityRead: vi.mocked(markAllActivityRead),
  clearActivityLogs: vi.mocked(clearActivityLogs),
}

const log = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
  id: 'a1',
  level: 'success',
  title: 'Đã xác nhận đơn hàng',
  message: 'DH-000012 đã chuyển sang Đã xác nhận',
  path: '/seller/orders/7f3c',
  created_at: '2026-11-18T07:30:00Z',
  read_at: null,
  changes: [],
  ...overrides,
})

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  api.markAllActivityRead.mockResolvedValue()
})

describe('NotificationBell', () => {
  it('hiện số chưa xem màu đỏ; không có thì ẩn số', async () => {
    api.fetchUnreadActivityCount.mockResolvedValue(3)
    renderWithProviders(<NotificationBell />, { route: '/' })
    expect(
      await screen.findByRole('button', { name: 'Thông báo (3 chưa xem)' }),
    ).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('mở chuông: hiện đủ thông tin (tiêu đề, nội dung, ngày giờ, trang) rồi đánh dấu đã xem', async () => {
    api.fetchUnreadActivityCount.mockResolvedValue(2)
    api.fetchActivityLogs.mockResolvedValue({
      items: [
        log({
          changes: [
            { field: 'Trạng thái', from: 'Chờ xác nhận', to: 'Đã xác nhận' },
            { field: 'Tồn kho Áo thun', from: '10', to: '8' },
            { field: 'Ghi chú', from: null, to: 'Giao gấp' },
          ],
        }),
        log({
          id: 'a2',
          level: 'error',
          title: 'Không xác nhận được đơn',
          message: 'Không đủ tồn kho',
          read_at: '2026-11-17T01:00:00Z',
          path: '/seller/orders',
        }),
      ],
      hasMore: false,
    })
    renderWithProviders(<NotificationBell />, { route: '/' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo (2 chưa xem)' }))

    expect(await screen.findByText('Đã xác nhận đơn hàng')).toBeInTheDocument()
    expect(screen.getByText('DH-000012 đã chuyển sang Đã xác nhận')).toBeInTheDocument()
    expect(screen.getByText(/18\/11\/2026 14:30 · Đơn hàng · Thành công/)).toBeInTheDocument()
    expect(screen.getByText('Mới')).toBeInTheDocument()
    // Chi tiết cũ → mới: giá trị cũ gạch ngang, mới in đậm; giá trị trống ghi rõ.
    const details = screen.getByLabelText('Chi tiết thay đổi')
    expect(details).toHaveTextContent('Trạng thái')
    expect(details).toHaveTextContent('Chờ xác nhận→Đã xác nhận')
    expect(details).toHaveTextContent('10→8')
    expect(details).toHaveTextContent('(trống)→Giao gấp')
    expect(screen.getByText(/· Lỗi$/)).toBeInTheDocument()

    await waitFor(() => expect(api.markAllActivityRead).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Thông báo' })).toBeInTheDocument()
  })

  it('nội dung đã ghi đủ "cũ → mới" thì không lặp lại bảng chi tiết', async () => {
    api.fetchUnreadActivityCount.mockResolvedValue(0)
    api.fetchActivityLogs.mockResolvedValue({
      items: [
        log({
          title: 'Đã lưu thay đổi sản phẩm',
          message: 'Áo thun\nGiá bán: 150.000 ₫ → 199.000 ₫',
          changes: [{ field: 'Giá bán', from: '150.000 ₫', to: '199.000 ₫' }],
          read_at: '2026-11-18T08:00:00Z',
        }),
      ],
      hasMore: false,
    })
    renderWithProviders(<NotificationBell />, { route: '/' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo' }))
    expect(await screen.findByText(/Giá bán: 150\.000 ₫ → 199\.000 ₫/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Chi tiết thay đổi')).not.toBeInTheDocument()
  })

  it('empty state khi chưa có thông báo; không gọi đánh dấu đã xem', async () => {
    api.fetchUnreadActivityCount.mockResolvedValue(0)
    api.fetchActivityLogs.mockResolvedValue({ items: [], hasMore: false })
    renderWithProviders(<NotificationBell />, { route: '/' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo' }))
    expect(await screen.findByText('Chưa có thông báo nào')).toBeInTheDocument()
    expect(api.markAllActivityRead).not.toHaveBeenCalled()
  })

  it('xem thêm tải thêm thông báo cũ hơn', async () => {
    api.fetchUnreadActivityCount.mockResolvedValue(0)
    api.fetchActivityLogs.mockResolvedValue({
      items: [log({ read_at: '2026-11-18T08:00:00Z' })],
      hasMore: true,
    })
    renderWithProviders(<NotificationBell />, { route: '/' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thêm thông báo cũ hơn' }))
    await waitFor(() => expect(api.fetchActivityLogs).toHaveBeenLastCalledWith(60))
  })

  it('xóa tất cả cần xác nhận', async () => {
    api.fetchUnreadActivityCount.mockResolvedValue(0)
    api.fetchActivityLogs.mockResolvedValue({
      items: [log({ read_at: '2026-11-18T08:00:00Z' })],
      hasMore: false,
    })
    api.clearActivityLogs.mockResolvedValue()
    renderWithProviders(<NotificationBell />, { route: '/' })

    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa tất cả' }))
    expect(api.clearActivityLogs).not.toHaveBeenCalled()

    await userEvent.click(await screen.findByRole('button', { name: 'Xóa tất cả' }))
    await waitFor(() => expect(api.clearActivityLogs).toHaveBeenCalledTimes(1))
  })
})
