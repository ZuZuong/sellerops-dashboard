import { Anchor, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconPrinter, IconReceiptOff, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { purchaseDetailPath, ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime } from '@/shared/lib/formatters'
import { useDeleteReceipt, useReceipt } from '../api/purchases.queries'
import { isEditable } from '../domain/receiptStatus'
import type { ReceiptDetail } from '../types'
import { ReceiptDocument } from './ReceiptDocument'
import { ReceiptForm } from './ReceiptForm'
import { ReceiptStatusBadge } from './ReceiptStatusBadge'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function BackLink() {
  return (
    <Anchor component={Link} to={ROUTES.purchases} size="sm" c="dimmed" data-print-hidden>
      <Group gap={4}>
        <IconArrowLeft size={14} aria-hidden />
        Danh sách phiếu nhập
      </Group>
    </Anchor>
  )
}

function NotFound() {
  return (
    <EmptyState
      icon={<IconReceiptOff size={24} stroke={1.5} />}
      title="Không tìm thấy phiếu nhập"
      description="Phiếu không tồn tại, đã bị xóa hoặc bạn không có quyền xem."
      action={
        <Button component={Link} to={ROUTES.purchases} size="xs" variant="light">
          Về danh sách phiếu nhập
        </Button>
      }
    />
  )
}

/** Tạo phiếu nhập mới (nháp). */
export function NewReceiptView() {
  const navigate = useNavigate()
  return (
    <Stack gap="md">
      <BackLink />
      <Title order={2}>Tạo phiếu nhập kho</Title>
      <ReceiptForm
        onCancel={() => void navigate(ROUTES.purchases)}
        onSaved={(id) => void navigate(purchaseDetailPath(id), { replace: true })}
      />
    </Stack>
  )
}

/** Phiếu nháp → form sửa (lưu / nhập kho / xóa); phiếu đã nhập kho → chứng từ để xem và in. */
export function ReceiptDetailView({ receiptId }: { receiptId: string }) {
  if (!UUID_PATTERN.test(receiptId)) return <NotFound />
  return <ReceiptDetailContent receiptId={receiptId} />
}

function ReceiptDetailContent({ receiptId }: { receiptId: string }) {
  const receipt = useReceipt(receiptId)

  if (receipt.isPending) {
    return (
      <Stack gap="md" aria-busy data-testid="receipt-skeleton">
        <Skeleton height={14} width={180} />
        <Skeleton height={32} width={260} />
        <Skeleton height={180} radius="md" />
        <Skeleton height={260} radius="md" />
      </Stack>
    )
  }
  if (receipt.isError) {
    return (
      <ErrorState
        message={getErrorMessage(receipt.error)}
        onRetry={() => void receipt.refetch()}
        retrying={receipt.isRefetching}
      />
    )
  }
  if (receipt.data === null) return <NotFound />

  return isEditable(receipt.data.status) ? (
    <DraftReceipt receipt={receipt.data} />
  ) : (
    <PostedReceipt receipt={receipt.data} />
  )
}

function Header({ receipt }: { receipt: ReceiptDetail }) {
  return (
    <Stack gap={4} data-print-hidden>
      <Group gap="sm">
        <Title order={2} ff="monospace">
          {receipt.code}
        </Title>
        <ReceiptStatusBadge status={receipt.status} />
      </Group>
      <Text size="sm" c="dimmed">
        Tạo lúc {formatDateTime(receipt.created_at)}
        {receipt.posted_at ? ` · nhập kho lúc ${formatDateTime(receipt.posted_at)}` : ''}
      </Text>
    </Stack>
  )
}

function DraftReceipt({ receipt }: { receipt: ReceiptDetail }) {
  const navigate = useNavigate()
  const remove = useDeleteReceipt()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Stack gap="md">
      <BackLink />
      <Header receipt={receipt} />
      <ReceiptForm
        // key: dữ liệu phiếu đổi sau khi lưu → form khởi tạo lại theo bản mới nhất.
        key={receipt.updated_at}
        receipt={receipt}
        onCancel={() => void navigate(ROUTES.purchases)}
        onSaved={() => {}}
        extraActions={
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} aria-hidden />}
            onClick={() => setConfirmDelete(true)}
          >
            Xóa nháp
          </Button>
        }
      />
      <ConfirmDialog
        opened={confirmDelete}
        title="Xóa phiếu nháp?"
        message={`Phiếu ${receipt.code} sẽ bị xóa. Tồn kho không thay đổi vì phiếu chưa nhập kho.`}
        confirmLabel="Xóa phiếu"
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(
            { id: receipt.id, code: receipt.code },
            { onSuccess: () => void navigate(ROUTES.purchases, { replace: true }) },
          )
        }
      />
    </Stack>
  )
}

function PostedReceipt({ receipt }: { receipt: ReceiptDetail }) {
  return (
    <Stack gap="md">
      <BackLink />
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Header receipt={receipt} />
        <Button
          variant="default"
          leftSection={<IconPrinter size={16} aria-hidden />}
          onClick={() => window.print()}
          data-print-hidden
        >
          In phiếu
        </Button>
      </Group>
      <ReceiptDocument receipt={receipt} />
    </Stack>
  )
}
