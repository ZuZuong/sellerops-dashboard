import {
  Alert,
  Anchor,
  Button,
  Grid,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertTriangle, IconArrowLeft, IconReceiptOff } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatDateTime } from '@/shared/lib/formatters'
import { useOrderDetail } from '../api/orders.queries'
import { useOrderTransitionFlow } from '../hooks/useOrderTransitionFlow'
import type { OrderDetail } from '../types'
import { OrderItemsTable } from './OrderItemsTable'
import { OrderStatusActions } from './OrderStatusActions'
import { OrderStatusBadge } from './OrderStatusBadge'
import { OrderTimeline } from './OrderTimeline'
import { OrderTransitionDialog } from './OrderTransitionDialog'

/** UUID hợp lệ — tránh gửi request với id rác (Postgres báo lỗi cú pháp uuid). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function OrderDetailView({ orderId }: { orderId: string }) {
  if (!UUID_PATTERN.test(orderId)) return <OrderNotFound />
  return <OrderDetailContent orderId={orderId} />
}

function OrderDetailContent({ orderId }: { orderId: string }) {
  const detail = useOrderDetail(orderId)

  if (detail.isPending) return <OrderDetailSkeleton />

  if (detail.isError) {
    return (
      <Section>
        <ErrorState
          message={getErrorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isRefetching}
        />
      </Section>
    )
  }

  if (detail.data === null) return <OrderNotFound />

  return <OrderDetailLoaded order={detail.data} />
}

function OrderDetailLoaded({ order }: { order: OrderDetail }) {
  const flow = useOrderTransitionFlow()
  const shortItems =
    order.status === 'pending'
      ? order.items.filter((item) => item.product && item.product.stock < item.quantity)
      : []

  return (
    <Stack gap="lg">
      <BackLink />

      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={4}>
          <Group gap="sm">
            <Title order={2} ff="monospace">
              {order.code}
            </Title>
            <OrderStatusBadge status={order.status} />
          </Group>
          <Text size="sm" c="dimmed">
            Tạo lúc {formatDateTime(order.created_at)}
          </Text>
        </Stack>
        <OrderStatusActions order={order} flow={flow} />
      </Group>

      {shortItems.length > 0 && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertTriangle size={18} aria-hidden />}
          title="Chưa đủ hàng để xác nhận"
        >
          {shortItems.map((item) => item.product?.name).join(', ')} đang có tồn kho thấp hơn số
          lượng đặt. Hãy nhập thêm hàng trước khi xác nhận đơn.
        </Alert>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Section title="Sản phẩm">
            <OrderItemsTable order={order} />
          </Section>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="lg">
            <Section title="Khách hàng">
              <Stack gap="xs">
                <InfoRow label="Tên">{order.customer_name}</InfoRow>
                <InfoRow label="Điện thoại">
                  {order.customer_phone ? (
                    <Anchor href={`tel:${order.customer_phone}`} size="sm">
                      {order.customer_phone}
                    </Anchor>
                  ) : (
                    '—'
                  )}
                </InfoRow>
                <InfoRow label="Tổng tiền">
                  <Text fw={600} size="sm">
                    {formatCurrency(order.total)}
                  </Text>
                </InfoRow>
              </Stack>
            </Section>
            <Section title="Trạng thái">
              <OrderTimeline order={order} />
            </Section>
          </Stack>
        </Grid.Col>
      </Grid>

      <OrderTransitionDialog flow={flow} />
    </Stack>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md">
      {title && (
        <Title order={3} size="h5" mb="sm">
          {title}
        </Title>
      )}
      {children}
    </Paper>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" component="div" ta="right" style={{ overflowWrap: 'anywhere' }}>
        {children}
      </Text>
    </Group>
  )
}

function BackLink() {
  return (
    <Anchor component={Link} to={ROUTES.orders} size="sm" c="dimmed">
      <Group gap={4}>
        <IconArrowLeft size={14} aria-hidden />
        Danh sách đơn hàng
      </Group>
    </Anchor>
  )
}

function OrderNotFound() {
  return (
    <Section>
      <EmptyState
        icon={<IconReceiptOff size={24} stroke={1.5} />}
        title="Không tìm thấy đơn hàng"
        description="Đơn hàng không tồn tại hoặc bạn không có quyền xem."
        action={
          <Button component={Link} to={ROUTES.orders} size="xs" variant="light">
            Về danh sách đơn hàng
          </Button>
        }
      />
    </Section>
  )
}

function OrderDetailSkeleton() {
  return (
    <Stack gap="lg" aria-busy data-testid="order-detail-skeleton">
      <Skeleton height={14} width={160} />
      <Skeleton height={32} width={240} />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Skeleton height={260} radius="md" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="lg">
            <Skeleton height={120} radius="md" />
            <Skeleton height={200} radius="md" />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
