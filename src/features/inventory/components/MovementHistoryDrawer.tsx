import {
  Anchor,
  Badge,
  Drawer,
  Group,
  Pagination,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { IconHistoryOff } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { orderDetailPath } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime, formatNumber } from '@/shared/lib/formatters'
import { useStockMovements } from '../api/inventory.queries'
import { getMovementReasonLabel } from '../lib/inventoryLib'
import type { InventoryItem, StockMovement } from '../types'

const PAGE_SIZE = 10

interface MovementHistoryDrawerProps {
  item: InventoryItem | null
  onClose: () => void
}

/** Lịch sử biến động kho của một sản phẩm (audit trail từ `inventory_movements`). */
export function MovementHistoryDrawer({ item, onClose }: MovementHistoryDrawerProps) {
  return (
    <Drawer
      opened={item !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title="Lịch sử biến động kho"
    >
      {item && <MovementHistory key={item.id} item={item} />}
    </Drawer>
  )
}

function MovementHistory({ item }: { item: InventoryItem }) {
  const [page, setPage] = useState(1)
  const movements = useStockMovements(item.id, page, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil((movements.data?.total ?? 0) / PAGE_SIZE))

  const renderBody = () => {
    if (movements.isPending) {
      return (
        <Stack gap="sm" aria-busy data-testid="movement-skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </Stack>
      )
    }
    if (movements.isError) {
      return (
        <ErrorState
          message={getErrorMessage(movements.error)}
          onRetry={() => void movements.refetch()}
          retrying={movements.isRefetching}
        />
      )
    }
    if (movements.data.items.length === 0) {
      return (
        <EmptyState
          icon={<IconHistoryOff size={24} stroke={1.5} />}
          title="Chưa có biến động kho"
          description="Nhập hàng, xác nhận / hủy đơn hoặc kiểm kê sẽ được ghi lại tại đây."
        />
      )
    }
    return (
      <Table.ScrollContainer minWidth={420}>
        <Table verticalSpacing="xs" aria-busy={movements.isPlaceholderData}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Thời gian</Table.Th>
              <Table.Th scope="col">Nội dung</Table.Th>
              <Table.Th scope="col" ta="right">
                Thay đổi
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {movements.data.items.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    )
  }

  return (
    <Stack gap="md">
      <Stack gap={2}>
        <Text fw={600}>{item.name}</Text>
        <Text size="sm" c="dimmed">
          <Text span ff="monospace" inherit>
            {item.sku}
          </Text>{' '}
          · Tồn kho hiện tại: {formatNumber(item.stock)}
        </Text>
      </Stack>
      {renderBody()}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={totalPages}
            value={Math.min(page, totalPages)}
            onChange={setPage}
            size="sm"
            getControlProps={(control) => ({
              'aria-label': control === 'previous' ? 'Trang trước' : 'Trang sau',
            })}
            getItemProps={(p) => ({ 'aria-label': `Trang ${p}` })}
          />
        </Group>
      )}
    </Stack>
  )
}

function MovementRow({ movement }: { movement: StockMovement }) {
  const increase = movement.delta > 0
  return (
    <Table.Tr>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" c="dimmed">
          {formatDateTime(movement.created_at)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Stack gap={0}>
          <Group gap={6}>
            <Text size="sm">{getMovementReasonLabel(movement.reason)}</Text>
            {movement.order && (
              <Anchor
                component={Link}
                to={orderDetailPath(movement.order.id)}
                size="sm"
                ff="monospace"
              >
                {movement.order.code}
              </Anchor>
            )}
          </Group>
          {movement.note && (
            <Text size="xs" c="dimmed">
              {movement.note}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td ta="right">
        {/* Dấu +/− là thông tin chính, màu chỉ bổ trợ. */}
        <Badge
          color={increase ? 'teal' : 'red'}
          variant="light"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {increase ? '+' : '−'}
          {formatNumber(Math.abs(movement.delta))}
        </Badge>
      </Table.Td>
    </Table.Tr>
  )
}
