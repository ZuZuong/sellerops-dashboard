import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ConfirmDialog } from './ConfirmDialog'

const baseProps = {
  opened: true,
  title: 'Xóa sản phẩm?',
  message: 'Không thể hoàn tác.',
  confirmLabel: 'Xóa vĩnh viễn',
}

describe('ConfirmDialog', () => {
  it('gọi onConfirm / onClose theo nút', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onClose={onClose} />)

    expect(await screen.findByRole('dialog', { name: 'Xóa sản phẩm?' })).toBeInTheDocument()
    expect(screen.getByText('Không thể hoàn tác.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Xóa vĩnh viễn' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('khi đang xử lý: không đóng được bằng Esc và nút Hủy bị khóa', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <ConfirmDialog {...baseProps} loading onConfirm={vi.fn()} onClose={onClose} />,
    )

    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
  })
})
