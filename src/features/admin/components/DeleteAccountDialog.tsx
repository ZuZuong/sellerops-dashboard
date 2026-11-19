import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  List,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { IconAlertTriangle, IconFileUpload, IconX } from '@tabler/icons-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { formatFileSize } from '@/shared/lib/formatters'
import { useDeleteAccount } from '../api/admin.queries'
import {
  deleteAccountSchema,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_MIME_TYPES,
  REASON_MAX,
  validateEvidenceFile,
  type DeleteAccountValues,
} from '../schemas/adminAction.schema'
import type { DeletionTarget } from '../types'

interface DeleteAccountDialogProps {
  target: DeletionTarget | null
  onClose: () => void
}

/**
 * Xóa (mềm) tài khoản: lý do bắt buộc + bằng chứng vi phạm (không bắt buộc). Tài khoản bị khóa
 * ngay, seller đang đăng nhập bị đăng xuất, email thông báo kèm hướng dẫn khiếu nại được gửi đi.
 */
export function DeleteAccountDialog({ target, onClose }: DeleteAccountDialogProps) {
  const remove = useDeleteAccount()
  return (
    <Modal
      opened={target !== null}
      onClose={remove.isPending ? () => {} : onClose}
      title="Xóa tài khoản"
      size="lg"
      centered
      closeOnClickOutside={!remove.isPending}
      closeOnEscape={!remove.isPending}
      withCloseButton={!remove.isPending}
    >
      {target && (
        <DeleteAccountForm
          key={target.userId}
          target={target}
          loading={remove.isPending}
          onCancel={onClose}
          onSubmit={({ reason, evidence }) =>
            remove.mutate({ target, reason, evidence }, { onSuccess: onClose })
          }
        />
      )}
    </Modal>
  )
}

interface DeleteAccountFormProps {
  target: DeletionTarget
  loading: boolean
  onCancel: () => void
  onSubmit: (values: DeleteAccountValues) => void
}

export function DeleteAccountForm({ target, loading, onCancel, onSubmit }: DeleteAccountFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { reason: '', evidence: [] },
  })
  const reason = useWatch({ control, name: 'reason' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Xóa tài khoản">
      <Stack gap="md">
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} aria-hidden />}>
          <Text size="sm">
            Xóa tài khoản <strong>{target.email}</strong>
            {target.shopName ? (
              <>
                {' '}
                (shop <strong>{target.shopName}</strong>)
              </>
            ) : null}
            :
          </Text>
          <List size="sm" mt={4} spacing={2}>
            <List.Item>Tài khoản bị khóa ngay, người dùng đang đăng nhập bị đăng xuất.</List.Item>
            <List.Item>
              Email thông báo lý do và hướng dẫn khiếu nại được gửi tới chủ tài khoản.
            </List.Item>
            <List.Item>
              Tài khoản chuyển vào thùng rác (mục "Chờ xóa") và khôi phục được cho tới khi admin xác
              nhận xóa vĩnh viễn.
            </List.Item>
          </List>
        </Alert>

        <Textarea
          label="Lý do xóa"
          description={`Nội dung này được gửi cho chủ tài khoản · ${reason.length}/${REASON_MAX} ký tự`}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          placeholder="VD: Kinh doanh hàng giả nhãn hiệu X, đã nhắc nhở 2 lần ngày 01/11 và 10/11."
          withAsterisk
          autosize
          minRows={3}
          maxRows={8}
          data-autofocus
          error={errors.reason?.message}
          {...register('reason')}
        />

        <Controller
          control={control}
          name="evidence"
          render={({ field }) => (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Bằng chứng vi phạm (không bắt buộc)
              </Text>
              <Dropzone
                onDrop={(files) => {
                  clearErrors('evidence')
                  field.onChange([...field.value, ...files].slice(0, EVIDENCE_MAX_FILES))
                }}
                onReject={(rejections) =>
                  setError('evidence', {
                    message: rejections
                      .map(
                        (r) =>
                          `${r.file.name}: ${validateEvidenceFile(r.file) ?? 'File không hợp lệ.'}`,
                      )
                      .join(' '),
                  })
                }
                accept={[...EVIDENCE_MIME_TYPES]}
                maxSize={EVIDENCE_MAX_BYTES}
                disabled={loading || field.value.length >= EVIDENCE_MAX_FILES}
                aria-label="Tải lên bằng chứng vi phạm"
              >
                <Group justify="center" gap="sm" mih={72} style={{ pointerEvents: 'none' }}>
                  <IconFileUpload size={28} stroke={1.5} aria-hidden />
                  <Stack gap={0}>
                    <Text size="sm">Kéo thả hoặc bấm để chọn ảnh chụp màn hình, tài liệu</Text>
                    <Text size="xs" c="dimmed">
                      JPG, PNG, WEBP, PDF · tối đa 10 MB/file · tối đa {EVIDENCE_MAX_FILES} file
                    </Text>
                  </Stack>
                </Group>
              </Dropzone>
              {field.value.length > 0 && (
                <Paper withBorder radius="md" p="xs">
                  <Stack gap={4}>
                    {field.value.map((file, index) => (
                      <Group key={`${file.name}-${index}`} justify="space-between" wrap="nowrap">
                        <Text size="sm" truncate="end">
                          {file.name} · {formatFileSize(file.size)}
                        </Text>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label={`Bỏ ${file.name}`}
                          disabled={loading}
                          onClick={() => field.onChange(field.value.filter((_, i) => i !== index))}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}
              {errors.evidence?.message && (
                <Text size="sm" c="red" role="alert">
                  {errors.evidence.message}
                </Text>
              )}
            </Stack>
          )}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={loading} data-autofocus={false}>
            Hủy
          </Button>
          <Button type="submit" color="red" loading={loading}>
            Xóa tài khoản
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
