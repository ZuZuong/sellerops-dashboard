import { Button, Group, Modal, Text } from '@mantine/core'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  opened: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Màu nút xác nhận; hành động phá hủy dùng 'red'. */
  color?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Hộp thoại xác nhận cho hành động phá hủy (xóa, ngừng bán...).
 * Nút "Hủy" nhận focus mặc định để Enter vô tình không thực hiện hành động; không cho đóng khi đang xử lý.
 */
export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Hủy',
  color = 'red',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={loading ? () => {} : onClose}
      title={title}
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      {typeof message === 'string' ? <Text size="sm">{message}</Text> : message}
      <Group justify="flex-end" mt="lg" gap="sm">
        <Button variant="default" onClick={onClose} disabled={loading} data-autofocus>
          {cancelLabel}
        </Button>
        <Button color={color} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  )
}
