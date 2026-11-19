import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useForm, useWatch } from 'react-hook-form'
import {
  noteSchema,
  REASON_MAX,
  reasonSchema,
  type ReasonValues,
} from '../schemas/adminAction.schema'

interface ReasonDialogProps {
  opened: boolean
  title: string
  description: string
  confirmLabel: string
  /** `red` cho hành động phá hủy (từ chối, khóa…). */
  color?: string
  /** Lý do bắt buộc (từ chối, khóa) hay chỉ là ghi chú tùy chọn (duyệt, mở khóa). */
  reasonRequired: boolean
  reasonLabel?: string
  loading: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}

/**
 * Hộp thoại xác nhận hành động của admin kèm lý do. Lý do được lưu vào audit_logs (và gửi tới
 * seller khi từ chối / tạm khóa). Không đóng được khi đang xử lý.
 */
export function ReasonDialog({ opened, onClose, loading, ...props }: ReasonDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={loading ? () => {} : onClose}
      title={props.title}
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      {opened && <ReasonForm {...props} loading={loading} onClose={onClose} />}
    </Modal>
  )
}

function ReasonForm({
  description,
  confirmLabel,
  color = 'red',
  reasonRequired,
  reasonLabel,
  loading,
  onConfirm,
  onClose,
}: Omit<ReasonDialogProps, 'opened' | 'title'>) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ReasonValues>({
    resolver: zodResolver(reasonRequired ? reasonSchema : noteSchema),
    defaultValues: { reason: '' },
  })
  const reason = useWatch({ control, name: 'reason' })

  return (
    <form onSubmit={handleSubmit(({ reason: value }) => onConfirm(value))} noValidate>
      <Stack gap="md">
        <Text size="sm">{description}</Text>
        <Textarea
          label={reasonLabel ?? (reasonRequired ? 'Lý do' : 'Ghi chú (không bắt buộc)')}
          withAsterisk={reasonRequired}
          autosize
          minRows={3}
          maxRows={8}
          data-autofocus
          description={`${reason.length}/${REASON_MAX} ký tự`}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          error={errors.reason?.message}
          {...register('reason')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="submit" color={color} loading={loading}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
