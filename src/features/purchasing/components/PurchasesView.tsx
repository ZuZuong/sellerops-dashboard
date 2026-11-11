import {
  Anchor,
  Button,
  Chip,
  CloseButton,
  Group,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { IconFilterOff, IconSearch, IconSearchOff, IconTruckLoading } from '@tabler/icons-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { purchaseDetailPath, ROUTES } from '@/shared/constants/routes'
import { useSearchInput } from '@/shared/hooks/useSearchInput'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatDate, formatNumber } from '@/shared/lib/formatters'
import { useReceipts } from '../api/purchases.queries'
import { RECEIPT_STATUS_META, RECEIPT_STATUSES } from '../domain/receiptStatus'
import { useReceiptFilters } from '../hooks/useReceiptFilters'
import { receiptFiltersSchema } from '../schemas/receiptFilters.schema'
import { ReceiptStatusBadge } from './ReceiptStatusBadge'

const COLUMNS = 7
const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  ...RECEIPT_STATUSES.map((status) => ({
    value: status,
    label: RECEIPT_STATUS_META[status].label,
  })),
]

export function CreateReceiptButton({ size }: { size?: 'xs' | 'sm' }) {
  return (
    <Button
      component={Link}
      to={ROUTES.purchaseNew}
      size={size}
      leftSection={<IconTruckLoading size={16} aria-hidden />}
    >
      Tạo phiếu nhập
    </Button>
  )
}

/** Danh sách phiếu nhập kho: lọc trạng thái + tìm (trên URL), phân trang phía server. */
export function PurchasesView() {
  const { filters, setFilters, setPage, resetFilters, hasActiveFilters } = useReceiptFilters()
  const receipts = useReceipts(filters)
  const [search, setSearch] = useSearchInput(filters.q, (q) => setFilters({ q }, { replace: true }))

  const total = receipts.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))

  useEffect(() => {
    if (receipts.data && !receipts.isPlaceholderData && filters.page > totalPages) {
      setPage(totalPages)
    }
  }, [filters.page, receipts.data, receipts.isPlaceholderData, setPage, totalPages])

  const head = (
    <Table.Thead>
      <Table.Tr>
        <Table.Th scope="col">Số phiếu</Table.Th>
        <Table.Th scope="col">Ngày nhập</Table.Th>
        <Table.Th scope="col">Nhà cung cấp</Table.Th>
        <Table.Th scope="col">Số HĐ</Table.Th>
        <Table.Th scope="col" ta="right">
          Thực nhận
        </Table.Th>
        <Table.Th scope="col" ta="right">
          Tiền hàng
        </Table.Th>
        <Table.Th scope="col">Trạng thái</Table.Th>
      </Table.Tr>
    </Table.Thead>
  )

  const renderBody = () => {
    if (receipts.isPending) {
      return (
        <Table.ScrollContainer minWidth={800}>
          <Table verticalSpacing="sm">
            {head}
            <Table.Tbody>
              {Array.from({ length: 6 }, (_, i) => (
                <Table.Tr key={i} data-testid="receipt-row-skeleton">
                  {Array.from({ length: COLUMNS }, (_, j) => (
                    <Table.Td key={j}>
                      <Skeleton height={14} />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )
    }
    if (receipts.isError) {
      return (
        <ErrorState
          message={getErrorMessage(receipts.error)}
          onRetry={() => void receipts.refetch()}
          retrying={receipts.isRefetching}
        />
      )
    }
    if (receipts.data.items.length === 0) {
      return hasActiveFilters ? (
        <EmptyState
          icon={<IconSearchOff size={24} stroke={1.5} />}
          title="Không có phiếu nhập phù hợp"
          description="Thử từ khóa khác hoặc chọn trạng thái khác."
          action={
            <Button variant="light" size="xs" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<IconTruckLoading size={24} stroke={1.5} />}
          title="Chưa có phiếu nhập nào"
          description="Lập phiếu nhập khi nhận hàng từ nhà cung cấp: tồn kho và giá vốn được cập nhật tự động."
          action={<CreateReceiptButton size="xs" />}
        />
      ) : null
    }
    return (
      <Table.ScrollContainer minWidth={800}>
        <Table verticalSpacing="sm" highlightOnHover>
          {head}
          <Table.Tbody>
            {receipts.data.items.map((receipt) => (
              <Table.Tr key={receipt.id}>
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={purchaseDetailPath(receipt.id)}
                    size="sm"
                    fw={500}
                    ff="monospace"
                  >
                    {receipt.code}
                  </Anchor>
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {formatDate(receipt.received_date)}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} maw={240}>
                    {receipt.supplier_name}
                  </Text>
                  {receipt.supplier_phone && (
                    <Text size="xs" c="dimmed">
                      {receipt.supplier_phone}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={receipt.invoice_number ? undefined : 'dimmed'}>
                    {receipt.invoice_number ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(receipt.received_qty)}
                  {receipt.defective_qty > 0 && (
                    <Text size="xs" c="orange.8">
                      {formatNumber(receipt.defective_qty)} lỗi
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatCurrency(receipt.total_amount)}
                </Table.Td>
                <Table.Td>
                  <ReceiptStatusBadge status={receipt.status} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    )
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm" mb="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            aria-label="Tìm theo số phiếu, nhà cung cấp hoặc số hóa đơn"
            placeholder="Tìm theo số phiếu, nhà cung cấp, số hóa đơn…"
            leftSection={<IconSearch size={16} aria-hidden />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            rightSection={
              search ? (
                <CloseButton size="sm" aria-label="Xóa từ khóa" onClick={() => setSearch('')} />
              ) : null
            }
            style={{ flex: '1 1 260px' }}
          />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} aria-hidden />}
              onClick={resetFilters}
            >
              Xóa bộ lọc
            </Button>
          )}
        </Group>
        <Chip.Group
          multiple={false}
          value={filters.status}
          onChange={(value) => {
            const status = receiptFiltersSchema.shape.status.safeParse(value)
            if (status.success) setFilters({ status: status.data })
          }}
        >
          <Group gap="xs" role="radiogroup" aria-label="Lọc theo trạng thái phiếu">
            {STATUS_OPTIONS.map((option) => (
              <Chip key={option.value} value={option.value} size="sm" variant="light">
                {option.label}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Stack>

      <div aria-busy={receipts.isFetching}>{renderBody()}</div>

      {receipts.data && totalPages > 1 && (
        <Group justify="flex-end" mt="md">
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
      )}
    </Paper>
  )
}
