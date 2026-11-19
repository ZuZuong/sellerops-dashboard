import { Alert, Button, Group, Modal, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertTriangle,
  IconClockHour4,
  IconEdit,
  IconLock,
  IconRefresh,
} from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { SignOutButton, useAccount } from '@/features/auth'
import { sellerKeys, type Seller } from '@/features/sellers'
import { formatDateTime } from '@/shared/lib/formatters'
import { resolveSellerGate } from '../domain/sellerGate'
import { OnboardingStepper } from './OnboardingStepper'

interface SellerGateModalProps {
  seller: Seller
}

const TITLES = {
  draft: 'Hoàn tất hồ sơ kinh doanh',
  rejected: 'Hồ sơ bị từ chối',
  pending: 'Hồ sơ đang chờ admin xét duyệt',
  suspended: 'Shop đang bị tạm khóa',
} as const

/**
 * Modal chặn dashboard khi shop chưa `approved`: KHÔNG đóng được (không nút đóng, không đóng khi
 * bấm ra ngoài / nhấn Esc). Luôn có nút "Đăng xuất" để seller không bị kẹt.
 */
export function SellerGateModal({ seller }: SellerGateModalProps) {
  const isMobile = useMediaQuery('(max-width: 36em)')
  const account = useAccount()
  const gate = resolveSellerGate(seller.status)
  const [editingRejected, setEditingRejected] = useState(false)

  if (gate === 'open') return null

  const showStepper = gate === 'draft' || (gate === 'rejected' && editingRejected)
  const title = showStepper ? TITLES.draft : TITLES[gate]

  let body: ReactNode
  if (showStepper) {
    body = (
      <OnboardingStepper
        seller={seller}
        accountId={account.data?.id ?? seller.owner_id ?? ''}
        accountEmail={account.data?.email ?? ''}
      />
    )
  } else if (gate === 'rejected') {
    body = <RejectedNotice seller={seller} onEdit={() => setEditingRejected(true)} />
  } else if (gate === 'pending') {
    body = <PendingNotice seller={seller} />
  } else {
    body = <SuspendedNotice seller={seller} />
  }

  return (
    <Modal
      opened
      onClose={() => {}}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      trapFocus
      centered
      size={showStepper ? 'xl' : 'md'}
      fullScreen={Boolean(isMobile) && showStepper}
      title={
        <Group justify="space-between" gap="sm" wrap="nowrap" w="100%">
          <Title order={2} size="h4">
            {title}
          </Title>
          <SignOutButton size="xs" />
        </Group>
      }
      styles={{ title: { flex: 1 } }}
      // Overlay đậm hơn mặc định: dashboard phía sau chỉ là nền, không thao tác được.
      overlayProps={{ backgroundOpacity: 0.6, blur: 2 }}
    >
      {body}
    </Modal>
  )
}

function StatusIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <ThemeIcon size={56} radius="xl" variant="light" color={color} aria-hidden>
      {children}
    </ThemeIcon>
  )
}

/** Làm mới trạng thái shop (vd. admin vừa duyệt) mà không phải tải lại trang. */
function RefreshStatusButton() {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  return (
    <Button
      variant="light"
      leftSection={<IconRefresh size={16} aria-hidden />}
      loading={loading}
      onClick={() => {
        setLoading(true)
        void queryClient
          .invalidateQueries({ queryKey: sellerKeys.all })
          .finally(() => setLoading(false))
      }}
    >
      Kiểm tra trạng thái
    </Button>
  )
}

function PendingNotice({ seller }: { seller: Seller }) {
  return (
    <Stack align="center" ta="center" gap="md" py="md">
      <StatusIcon color="yellow">
        <IconClockHour4 size={30} />
      </StatusIcon>
      <Text>
        Hồ sơ của shop <strong>{seller.shop_name}</strong> đã được gửi
        {seller.submitted_at ? ` lúc ${formatDateTime(seller.submitted_at)}` : ''}.
      </Text>
      <Text size="sm" c="dimmed">
        Quản trị viên sẽ xem xét hồ sơ và giấy tờ của bạn. Dashboard sẽ mở khóa ngay khi hồ sơ được
        duyệt.
      </Text>
      <RefreshStatusButton />
    </Stack>
  )
}

function RejectedNotice({ seller, onEdit }: { seller: Seller; onEdit: () => void }) {
  return (
    <Stack gap="md" py="xs">
      <Group justify="center">
        <StatusIcon color="red">
          <IconAlertTriangle size={30} />
        </StatusIcon>
      </Group>
      <Text ta="center">
        Hồ sơ của shop <strong>{seller.shop_name}</strong> chưa được duyệt.
      </Text>
      <Alert color="red" variant="light" title="Lý do từ chối">
        {seller.rejection_reason ?? 'Quản trị viên không ghi lý do.'}
      </Alert>
      <Text size="sm" c="dimmed" ta="center">
        Hãy sửa hồ sơ theo góp ý rồi gửi lại. Dữ liệu bạn đã nhập vẫn được giữ nguyên.
      </Text>
      <Group justify="center">
        <Button leftSection={<IconEdit size={16} aria-hidden />} onClick={onEdit}>
          Sửa và gửi lại hồ sơ
        </Button>
      </Group>
    </Stack>
  )
}

function SuspendedNotice({ seller }: { seller: Seller }) {
  return (
    <Stack align="center" ta="center" gap="md" py="md">
      <StatusIcon color="orange">
        <IconLock size={30} />
      </StatusIcon>
      <Text>
        Shop <strong>{seller.shop_name}</strong> đang bị quản trị viên tạm khóa. Bạn không thể thao
        tác trên dữ liệu kinh doanh cho tới khi shop được mở khóa.
      </Text>
      {seller.suspended_reason && (
        <Alert color="orange" variant="light" title="Lý do" w="100%" ta="left">
          {seller.suspended_reason}
        </Alert>
      )}
      <RefreshStatusButton />
    </Stack>
  )
}
