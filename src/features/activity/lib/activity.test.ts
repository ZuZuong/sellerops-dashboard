import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_SKIP_ATTR,
  describePath,
  formatUnreadCount,
  levelFromColor,
  toActivityInput,
  toPlainText,
} from './activity'

describe('activity log helpers', () => {
  it('màu toast → mức độ', () => {
    expect(levelFromColor('green')).toBe('success')
    expect(levelFromColor('red')).toBe('error')
    expect(levelFromColor('orange')).toBe('warning')
    expect(levelFromColor(undefined)).toBe('info')
  })

  it('toPlainText: chuỗi / số / mảng chữ; JSX → null', () => {
    expect(toPlainText('  Đã tạo đơn ')).toBe('Đã tạo đơn')
    expect(toPlainText(['Còn ', 5, ' sản phẩm'])).toBe('Còn 5 sản phẩm')
    expect(toPlainText({ type: 'b', props: {}, key: null } as never)).toBeNull()
    expect(toPlainText('   ')).toBeNull()
  })

  it('toActivityInput: tiêu đề + nội dung + trang; bỏ qua toast có cờ skip', () => {
    expect(
      toActivityInput(
        { color: 'green', title: 'Đã tạo đơn hàng', message: 'Đơn của An đang chờ xác nhận' },
        '/orders',
      ),
    ).toEqual({
      level: 'success',
      title: 'Đã tạo đơn hàng',
      message: 'Đơn của An đang chờ xác nhận',
      path: '/orders',
      changes: [],
    })
    expect(
      toActivityInput({ title: 'x', message: 'y', [ACTIVITY_SKIP_ATTR]: true }, '/'),
    ).toBeNull()
  })

  it('toast không có tiêu đề → nội dung thành tiêu đề; nội dung quá dài bị cắt', () => {
    expect(toActivityInput({ message: 'Đã lưu' }, null)).toMatchObject({
      title: 'Đã lưu',
      message: null,
    })
    const long = toActivityInput({ title: 'T', message: 'a'.repeat(1500) }, null)
    expect(long?.message).toHaveLength(1000)
    expect(long?.message?.endsWith('…')).toBe(true)
  })

  it('describePath: khớp tiền tố dài nhất', () => {
    expect(describePath('/')).toBe('Tổng quan')
    expect(describePath('/orders/7f3c')).toBe('Đơn hàng')
    expect(describePath('/inventory/stocktake')).toBe('Biên bản kiểm kê')
    expect(describePath('/products/trash')).toBe('Thùng rác sản phẩm')
    expect(describePath('/unknown')).toBeNull()
    expect(describePath(null)).toBeNull()
  })

  it('formatUnreadCount: quá 99 → 99+', () => {
    expect(formatUnreadCount(7)).toBe('7')
    expect(formatUnreadCount(120)).toBe('99+')
  })
})
