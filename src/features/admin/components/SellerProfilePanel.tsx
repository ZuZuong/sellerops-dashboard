import {
  Alert,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconCheck,
  IconEye,
  IconFileText,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime, formatFileSize } from '@/shared/lib/formatters'
import { SELLER_DOCUMENTS_BUCKET } from '../api/admin.api'
import {
  useOpenPrivateFile,
  useReviewSeller,
  useSellerDocuments,
  useSetSellerSuspended,
} from '../api/admin.queries'
import type { AdminSellerDetail, DeletionTarget } from '../types'
import { AccountStateBadge } from './common'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { ReasonDialog } from './ReasonDialog'

const BUSINESS_TYPE_LABELS: Readonly<Record<string, string>> = {
  household: 'Hộ kinh doanh',
  company: 'Công ty',
  individual: 'Cá nhân kinh doanh',
}

const DOCUMENT_KIND_LABELS: Readonly<Record<string, string>> = {
  business_license: 'Giấy phép kinh doanh',
  representative_id: 'Giấy tờ người đại diện',
}

type PendingAction = 'approve' | 'reject' | 'suspend' | 'unsuspend' | null

/** Tab "Hồ sơ": thông tin đăng ký, giấy tờ, trạng thái và các hành động của admin. */
export function SellerProfilePanel({ seller }: { seller: AdminSellerDetail }) {
  const review = useReviewSeller()
  const suspend = useSetSellerSuspended()
  const [action, setAction] = useState<PendingAction>(null)
  const [deleting, setDeleting] = useState<DeletionTarget | null>(null)
  const target = { sellerId: seller.id, shopName: seller.shop_name }
  const close = () => setAction(null)
  const accountActive = seller.account_status === 'active'

  return (
    <Stack gap="md">
      <StatusNotice seller={seller} />

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm" wrap="wrap" gap="sm">
          <Title order={2} size="h4">
            Hồ sơ kinh doanh
          </Title>
          <Group gap="xs">
            {seller.status === 'pending' && (
              <>
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconX size={16} aria-hidden />}
                  onClick={() => setAction('reject')}
                >
                  Từ chối
                </Button>
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} aria-hidden />}
                  onClick={() => setAction('approve')}
                >
                  Duyệt hồ sơ
                </Button>
              </>
            )}
            {seller.status === 'approved' && (
              <Button
                variant="light"
                color="orange"
                leftSection={<IconLock size={16} aria-hidden />}
                onClick={() => setAction('suspend')}
              >
                Tạm khóa shop
              </Button>
            )}
            {seller.status === 'suspended' && (
              <Button
                variant="light"
                color="green"
                leftSection={<IconLockOpen size={16} aria-hidden />}
                onClick={() => setAction('unsuspend')}
              >
                Mở khóa shop
              </Button>
            )}
            {accountActive && (
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} aria-hidden />}
                onClick={() =>
                  setDeleting({
                    userId: seller.owner_id,
                    email: seller.owner_email,
                    shopName: seller.shop_name,
                  })
                }
              >
                Xóa tài khoản
              </Button>
            )}
          </Group>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" verticalSpacing="sm">
          <Field label="Tên shop" value={seller.shop_name} />
          <Field label="Loại hình" value={BUSINESS_TYPE_LABELS[seller.business_type] ?? null} />
          <Field label="Tên doanh nghiệp" value={seller.business_name} />
          <Field label="Mã số thuế" value={seller.tax_code} mono />
          <Field label="Số giấy phép kinh doanh" value={seller.license_number} mono />
          <Field label="Ngành hàng chính" value={seller.main_category} />
          <Field label="Địa chỉ" value={seller.address} />
          <Field label="Người đại diện" value={seller.representative_name} />
          <Field label="SĐT người đại diện" value={seller.representative_phone} mono />
          <Field label="Email liên hệ" value={seller.contact_email} />
          <Field label="Email đăng nhập" value={seller.owner_email} />
          <Field label="Tài khoản" value={<AccountStateBadge account={seller} />} />
          <Field
            label="Gửi hồ sơ"
            value={seller.submitted_at ? formatDateTime(seller.submitted_at) : null}
          />
          <Field
            label="Cam kết đã chấp nhận"
            value={
              seller.terms_version
                ? `Phiên bản ${seller.terms_version}${seller.terms_accepted_at ? ` · ${formatDateTime(seller.terms_accepted_at)}` : ''}`
                : null
            }
          />
          <Field
            label="Xét duyệt"
            value={
              seller.reviewed_at
                ? `${formatDateTime(seller.reviewed_at)}${seller.reviewer_email ? ` · ${seller.reviewer_email}` : ''}`
                : null
            }
          />
        </SimpleGrid>
      </Paper>

      <DocumentsCard sellerId={seller.id} />

      <ReasonDialog
        opened={action === 'approve'}
        title="Duyệt hồ sơ"
        description={`Duyệt "${seller.shop_name ?? ''}": dashboard của seller được mở khóa ngay.`}
        confirmLabel="Duyệt hồ sơ"
        color="green"
        reasonRequired={false}
        loading={review.isPending}
        onConfirm={(reason) =>
          review.mutate({ ...target, decision: 'approved', reason }, { onSuccess: close })
        }
        onClose={close}
      />
      <ReasonDialog
        opened={action === 'reject'}
        title="Từ chối hồ sơ"
        description="Seller sẽ thấy lý do này và có thể sửa hồ sơ rồi gửi lại."
        confirmLabel="Từ chối hồ sơ"
        reasonRequired
        reasonLabel="Lý do từ chối"
        loading={review.isPending}
        onConfirm={(reason) =>
          review.mutate({ ...target, decision: 'rejected', reason }, { onSuccess: close })
        }
        onClose={close}
      />
      <ReasonDialog
        opened={action === 'suspend' || action === 'unsuspend'}
        title={action === 'suspend' ? 'Tạm khóa shop' : 'Mở khóa shop'}
        description={
          action === 'suspend'
            ? 'Dashboard của seller bị khóa ngay, seller thấy lý do trên màn hình.'
            : 'Dashboard của seller hoạt động lại ngay.'
        }
        confirmLabel={action === 'suspend' ? 'Tạm khóa shop' : 'Mở khóa shop'}
        color={action === 'suspend' ? 'red' : 'green'}
        reasonRequired={action === 'suspend'}
        loading={suspend.isPending}
        onConfirm={(reason) =>
          suspend.mutate(
            { ...target, suspended: action === 'suspend', reason },
            { onSuccess: close },
          )
        }
        onClose={close}
      />
      <DeleteAccountDialog target={deleting} onClose={() => setDeleting(null)} />
    </Stack>
  )
}

function StatusNotice({ seller }: { seller: AdminSellerDetail }) {
  if (seller.account_status !== 'active') {
    return (
      <Alert color="dark" variant="light" icon={<IconAlertTriangle size={18} aria-hidden />}>
        Tài khoản chủ shop đã bị xóa (
        {seller.account_status === 'deleted' ? 'đã xác nhận' : 'chờ xác nhận'}). Lý do:{' '}
        {seller.locked_reason ?? '—'}
      </Alert>
    )
  }
  if (seller.status === 'rejected' && seller.rejection_reason) {
    return (
      <Alert color="red" variant="light" title="Lý do từ chối">
        {seller.rejection_reason}
      </Alert>
    )
  }
  if (seller.status === 'suspended' && seller.suspended_reason) {
    return (
      <Alert color="orange" variant="light" title="Lý do tạm khóa">
        {seller.suspended_reason}
      </Alert>
    )
  }
  if (seller.status === 'pending') {
    return (
      <Alert color="yellow" variant="light" title="Hồ sơ đang chờ duyệt">
        Kiểm tra thông tin và giấy tờ bên dưới trước khi duyệt hoặc từ chối.
      </Alert>
    )
  }
  return null
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <Stack gap={2} miw={0}>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase">
        {label}
      </Text>
      {typeof value === 'string' || value === null ? (
        <Text size="sm" ff={mono ? 'monospace' : undefined} style={{ overflowWrap: 'anywhere' }}>
          {value ?? '—'}
        </Text>
      ) : (
        <div>{value}</div>
      )}
    </Stack>
  )
}

function DocumentsCard({ sellerId }: { sellerId: string }) {
  const documents = useSellerDocuments(sellerId)
  const file = useOpenPrivateFile(SELLER_DOCUMENTS_BUCKET)

  return (
    <Paper withBorder radius="md" p="md">
      <Title order={2} size="h4" mb="sm">
        Giấy tờ
      </Title>
      {documents.isPending ? (
        <Stack gap="xs">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </Stack>
      ) : documents.isError ? (
        <ErrorState
          message={getErrorMessage(documents.error)}
          onRetry={() => void documents.refetch()}
          retrying={documents.isRefetching}
        />
      ) : documents.data.length === 0 ? (
        <EmptyState
          icon={<IconFileText size={24} stroke={1.5} />}
          title="Chưa có giấy tờ"
          description="Seller chưa tải lên giấy tờ nào."
        />
      ) : (
        <Stack gap="xs">
          {documents.data.map((document) => (
            <Group key={document.id} justify="space-between" wrap="nowrap" gap="sm">
              <Stack gap={0} miw={0}>
                <Text size="sm" fw={500}>
                  {DOCUMENT_KIND_LABELS[document.kind] ?? document.kind}
                </Text>
                <Text size="xs" c="dimmed" truncate="end">
                  {document.file_name} · {formatFileSize(document.file_size)} ·{' '}
                  {formatDateTime(document.created_at)}
                </Text>
              </Stack>
              <Button
                size="compact-sm"
                variant="light"
                leftSection={<IconEye size={14} aria-hidden />}
                loading={file.pendingPath === document.storage_path}
                onClick={() => file.open(document.storage_path)}
                aria-label={`Xem ${document.file_name}`}
              >
                Xem
              </Button>
            </Group>
          ))}
          <Text size="xs" c="dimmed">
            Link xem giấy tờ chỉ có hiệu lực 60 giây.
          </Text>
        </Stack>
      )}
    </Paper>
  )
}
