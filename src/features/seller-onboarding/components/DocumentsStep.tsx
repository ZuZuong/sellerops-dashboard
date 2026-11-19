import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Paper,
  Progress,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconEye, IconFileUpload, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatFileSize } from '@/shared/lib/formatters'
import type { SellerDocument } from '../api/onboarding.api'
import {
  useDeleteDocument,
  useOpenDocument,
  useSellerDocuments,
  useUploadDocument,
} from '../api/onboarding.queries'
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KIND_META,
  validateDocumentFile,
  type DocumentKind,
} from '../lib/documentFile'
import { documentsStepSchema } from '../schemas/application.schema'
import { StepFooter } from './StepFooter'

interface DocumentsStepProps {
  sellerId: string
  ownerId: string
  saving: boolean
  onBack: () => void
  onNext: () => void
}

const KINDS: readonly DocumentKind[] = ['business_license', 'representative_id']

/** Bước 2 — giấy tờ: giấy phép kinh doanh (bắt buộc), giấy tờ người đại diện (tùy chọn). */
export function DocumentsStep({ sellerId, ownerId, saving, onBack, onNext }: DocumentsStepProps) {
  const documents = useSellerDocuments(sellerId)
  const [stepError, setStepError] = useState<string | null>(null)
  const licenseCount = (documents.data ?? []).filter((d) => d.kind === 'business_license').length

  const handleNext = () => {
    const parsed = documentsStepSchema.safeParse({ businessLicenseCount: licenseCount })
    if (!parsed.success) {
      setStepError(parsed.error.issues[0]?.message ?? null)
      return
    }
    setStepError(null)
    onNext()
  }

  if (documents.isError) {
    return (
      <ErrorState
        message={getErrorMessage(documents.error)}
        onRetry={() => void documents.refetch()}
        retrying={documents.isRefetching}
      />
    )
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Chỉ nhận file PDF, JPG hoặc PNG, tối đa 5 MB mỗi file. Giấy tờ được lưu riêng tư, chỉ bạn và
        quản trị viên xem được.
      </Text>
      {KINDS.map((kind) =>
        documents.isPending ? (
          <Skeleton key={kind} height={96} radius="md" />
        ) : (
          <DocumentSlot
            key={kind}
            kind={kind}
            sellerId={sellerId}
            ownerId={ownerId}
            current={documents.data.filter((d) => d.kind === kind).at(-1) ?? null}
          />
        ),
      )}
      {stepError && licenseCount === 0 && (
        <Alert color="red" icon={<IconAlertCircle size={18} aria-hidden />} role="alert">
          {stepError}
        </Alert>
      )}
      <StepFooter
        onBack={onBack}
        onNext={handleNext}
        loading={saving}
        nextDisabled={documents.isPending}
      />
    </Stack>
  )
}

interface DocumentSlotProps {
  kind: DocumentKind
  sellerId: string
  ownerId: string
  /** Giấy tờ hiện có của loại này (mỗi loại giữ 1 file; tải file mới = thay thế). */
  current: SellerDocument | null
}

function DocumentSlot({ kind, sellerId, ownerId, current }: DocumentSlotProps) {
  const meta = DOCUMENT_KIND_META[kind]
  const upload = useUploadDocument()
  const remove = useDeleteDocument(sellerId)
  const openDocument = useOpenDocument()
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleFile = (file: File | null) => {
    if (!file) return
    const error = validateDocumentFile(file)
    setFileError(error)
    if (error) return
    setProgress(0)
    upload.mutate({
      ownerId,
      sellerId,
      kind,
      file,
      replace: current ?? undefined,
      onProgress: setProgress,
    })
  }

  const labelId = `document-${kind}`

  return (
    <Paper withBorder radius="md" p="md" aria-labelledby={labelId}>
      <Stack gap="xs">
        <Group justify="space-between" gap="xs" wrap="wrap">
          <Group gap="xs">
            <Text fw={600} id={labelId}>
              {meta.label}
            </Text>
            <Badge size="sm" variant="light" color={meta.required ? 'red' : 'gray'}>
              {meta.required ? 'Bắt buộc' : 'Tùy chọn'}
            </Badge>
          </Group>
          <FileButton onChange={handleFile} accept={DOCUMENT_ACCEPT} disabled={upload.isPending}>
            {(props) => (
              <Button
                {...props}
                size="xs"
                variant={current ? 'default' : 'light'}
                leftSection={<IconFileUpload size={16} aria-hidden />}
                loading={upload.isPending}
                aria-label={`${current ? 'Thay' : 'Tải lên'} ${meta.label.toLowerCase()}`}
              >
                {current ? 'Thay file' : 'Tải lên'}
              </Button>
            )}
          </FileButton>
        </Group>
        <Text size="xs" c="dimmed">
          {meta.hint}
        </Text>

        {upload.isPending && (
          <Progress
            value={progress}
            size="sm"
            animated
            aria-label={`Đang tải ${meta.label.toLowerCase()}: ${progress}%`}
          />
        )}
        {fileError && (
          <Text size="sm" c="red" role="alert">
            {fileError}
          </Text>
        )}

        {current && (
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="sm" truncate="end" title={current.file_name}>
              {current.file_name} · {formatFileSize(current.file_size)}
            </Text>
            <Group gap={4} wrap="nowrap">
              <Tooltip label="Xem">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Xem ${current.file_name}`}
                  loading={openDocument.isPending}
                  onClick={() => openDocument.open(current)}
                >
                  <IconEye size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Xóa">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Xóa ${current.file_name}`}
                  onClick={() => setConfirmDelete(true)}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        )}
      </Stack>

      <ConfirmDialog
        opened={confirmDelete}
        title={`Xóa ${meta.label.toLowerCase()}?`}
        message={`File "${current?.file_name ?? ''}" sẽ bị xóa khỏi hồ sơ.`}
        confirmLabel="Xóa file"
        loading={remove.isPending}
        onConfirm={() => {
          if (current) remove.mutate(current, { onSettled: () => setConfirmDelete(false) })
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </Paper>
  )
}
