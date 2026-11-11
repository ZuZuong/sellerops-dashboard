import { Button, Group, Pagination, Paper, Select, Skeleton, Table, Text } from '@mantine/core'
import { IconReceipt, IconSearchOff } from '@tabler/icons-react'
import { useEffect } from 'react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatNumber } from '@/shared/lib/formatters'
import { useOrders } from '../api/orders.queries'
import { useOrderFilters } from '../hooks/useOrderFilters'
import { useOrderTransitionFlow } from '../hooks/useOrderTransitionFlow'
import { ORDER_PAGE_SIZES } from '../schemas/orderFilters.schema'
import { CreateOrderButton } from './CreateOrderButton'
import { OrderFilters } from './OrderFilters'
import { ORDER_TABLE_COLUMNS, OrderTable, OrderTableShell } from './OrderTable'
import { OrderTransitionDialog } from './OrderTransitionDialog'

const PAGE_SIZE_OPTIONS = ORDER_PAGE_SIZES.map((size) => ({
  value: String(size),
  label: `${size} / trang`,
}))

/** Danh sách đơn hàng: lọc theo trạng thái + tìm kiếm (trên URL), bảng, phân trang, thao tác nhanh. */
export function OrdersView() {
  const { filters, setFilters, setPage, toggleSort, resetFilters, hasActiveFilters } =
    useOrderFilters()
  const orders = useOrders(filters)
  const flow = useOrderTransitionFlow()

  const total = orders.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))

  // Trang hiện tại vượt quá số trang (vd. đơn vừa đổi trạng thái rời khỏi bộ lọc) → lùi về trang cuối.
  useEffect(() => {
    if (orders.data && !orders.isPlaceholderData && filters.page > totalPages) {
      setPage(totalPages)
    }
  }, [filters.page, orders.data, orders.isPlaceholderData, setPage, totalPages])

  const renderBody = () => {
    if (orders.isPending) {
      return (
        <OrderTableShell sort={filters.sort} order={filters.order}>
          {Array.from({ length: Math.min(filters.pageSize, 10) }, (_, i) => (
            <Table.Tr key={i} data-testid="order-row-skeleton">
              {Array.from({ length: ORDER_TABLE_COLUMNS }, (_, j) => (
                <Table.Td key={j}>
                  <Skeleton height={14} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </OrderTableShell>
      )
    }

    if (orders.isError) {
      return (
        <ErrorState
          message={getErrorMessage(orders.error)}
          onRetry={() => void orders.refetch()}
          retrying={orders.isRefetching}
        />
      )
    }

    if (orders.data.items.length === 0) {
      return hasActiveFilters ? (
        <EmptyState
          icon={<IconSearchOff size={24} stroke={1.5} />}
          title="Không tìm thấy đơn hàng phù hợp"
          description="Thử từ khóa khác hoặc chọn trạng thái khác."
          action={
            <Button variant="light" size="xs" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<IconReceipt size={24} stroke={1.5} />}
          title="Chưa có đơn hàng nào"
          description="Tạo đơn hàng đầu tiên: chọn sản phẩm, số lượng và thông tin khách."
          action={<CreateOrderButton size="xs" variant="light" />}
        />
      ) : null // đang lùi về trang hợp lệ (effect ở trên)
    }

    return (
      <OrderTable
        orders={orders.data.items}
        sort={filters.sort}
        order={filters.order}
        onSort={toggleSort}
        onTransition={(order, to) => flow.request({ order, to })}
        busyOrderId={flow.runningOrderId}
      />
    )
  }

  const from = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1
  const to = Math.min(filters.page * filters.pageSize, total)

  return (
    <Paper withBorder radius="md" p="md">
      <OrderFilters
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div aria-busy={orders.isFetching}>{renderBody()}</div>

      {orders.data && total > 0 && (
        <Group justify="space-between" mt="md" gap="sm" wrap="wrap">
          <Text size="sm" c="dimmed">
            Hiển thị {formatNumber(from)}–{formatNumber(to)} trong {formatNumber(total)} đơn hàng
          </Text>
          <Group gap="sm" wrap="wrap">
            <Select
              aria-label="Số đơn mỗi trang"
              data={PAGE_SIZE_OPTIONS}
              value={String(filters.pageSize)}
              onChange={(value) => value && setFilters({ pageSize: Number(value) })}
              allowDeselect={false}
              w={130}
            />
            <Pagination
              total={totalPages}
              value={Math.min(filters.page, totalPages)}
              onChange={setPage}
              siblings={1}
              boundaries={1}
              getControlProps={(control) => ({
                'aria-label': control === 'previous' ? 'Trang trước' : 'Trang sau',
              })}
              getItemProps={(page) => ({ 'aria-label': `Trang ${page}` })}
            />
          </Group>
        </Group>
      )}

      <OrderTransitionDialog flow={flow} />
    </Paper>
  )
}
