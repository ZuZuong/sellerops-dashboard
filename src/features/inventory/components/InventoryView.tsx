import {
  Button,
  CloseButton,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconDownload,
  IconFilterOff,
  IconPackage,
  IconSearch,
  IconSearchOff,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { useSearchInput } from '@/shared/hooks/useSearchInput'
import { downloadCsv } from '@/shared/lib/csv'
import { todayKey } from '@/shared/lib/dates'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatNumber } from '@/shared/lib/formatters'
import { EXPORT_LIMIT, fetchInventoryForExport } from '../api/inventory.api'
import { useInventory } from '../api/inventory.queries'
import { useInventoryFilters } from '../hooks/useInventoryFilters'
import { inventoryToCsv } from '../lib/inventoryCsv'
import { INVENTORY_PAGE_SIZES, inventoryFiltersSchema } from '../schemas/inventoryFilters.schema'
import type { InventoryItem } from '../types'
import { InventorySummaryCards } from './InventorySummaryCards'
import { INVENTORY_TABLE_COLUMNS, InventoryTable, InventoryTableShell } from './InventoryTable'
import { MovementHistoryDrawer } from './MovementHistoryDrawer'
import { StockAdjustModal } from './StockAdjustModal'

const LEVEL_OPTIONS = [
  { value: 'all', label: 'Mọi mức tồn kho' },
  { value: 'low', label: 'Sắp hết hàng' },
  { value: 'out', label: 'Hết hàng' },
  { value: 'ok', label: 'Còn hàng (trên ngưỡng)' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Sản phẩm đang bán' },
  { value: 'all', label: 'Gồm cả ngừng bán' },
]

const PAGE_SIZE_OPTIONS = INVENTORY_PAGE_SIZES.map((size) => ({
  value: String(size),
  label: `${size} / trang`,
}))

/** Trang Kho hàng: tổng quan, bảng tồn kho (lọc trên URL), điều chỉnh kho, lịch sử, xuất CSV. */
export function InventoryView() {
  const { filters, setFilters, setPage, toggleSort, resetFilters, hasActiveFilters } =
    useInventoryFilters()
  const inventory = useInventory(filters)
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null)
  const [viewingHistory, setViewingHistory] = useState<InventoryItem | null>(null)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useSearchInput(filters.q, (q) => setFilters({ q }, { replace: true }))

  const total = inventory.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))

  useEffect(() => {
    if (inventory.data && !inventory.isPlaceholderData && filters.page > totalPages) {
      setPage(totalPages)
    }
  }, [filters.page, inventory.data, inventory.isPlaceholderData, setPage, totalPages])

  const handleExport = async () => {
    setExporting(true)
    try {
      const items = await fetchInventoryForExport(filters)
      downloadCsv(`ton-kho-${todayKey()}.csv`, inventoryToCsv(items))
      notifications.show({
        color: 'green',
        title: 'Đã xuất file CSV',
        message:
          items.length >= EXPORT_LIMIT
            ? `${formatNumber(items.length)} sản phẩm đầu tiên (giới hạn mỗi lần xuất)`
            : `${formatNumber(items.length)} sản phẩm`,
      })
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Không xuất được file CSV',
        message: getErrorMessage(error),
      })
    } finally {
      setExporting(false)
    }
  }

  const renderBody = () => {
    if (inventory.isPending) {
      return (
        <InventoryTableShell sort={filters.sort} order={filters.order}>
          {Array.from({ length: Math.min(filters.pageSize, 10) }, (_, i) => (
            <Table.Tr key={i} data-testid="inventory-row-skeleton">
              {Array.from({ length: INVENTORY_TABLE_COLUMNS }, (_, j) => (
                <Table.Td key={j}>
                  <Skeleton height={14} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </InventoryTableShell>
      )
    }

    if (inventory.isError) {
      return (
        <ErrorState
          message={getErrorMessage(inventory.error)}
          onRetry={() => void inventory.refetch()}
          retrying={inventory.isRefetching}
        />
      )
    }

    if (inventory.data.items.length === 0) {
      return hasActiveFilters ? (
        <EmptyState
          icon={<IconSearchOff size={24} stroke={1.5} />}
          title="Không có sản phẩm phù hợp"
          description="Thử từ khóa khác hoặc bỏ bớt điều kiện lọc."
          action={
            <Button variant="light" size="xs" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<IconPackage size={24} stroke={1.5} />}
          title="Kho chưa có sản phẩm"
          description="Thêm sản phẩm ở trang Sản phẩm để bắt đầu theo dõi tồn kho."
        />
      ) : null
    }

    return (
      <InventoryTable
        items={inventory.data.items}
        sort={filters.sort}
        order={filters.order}
        onSort={toggleSort}
        onAdjust={setAdjusting}
        onHistory={setViewingHistory}
      />
    )
  }

  const from = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1
  const to = Math.min(filters.page * filters.pageSize, total)

  return (
    <Stack gap="md">
      <InventorySummaryCards onSelectLevel={(level) => setFilters({ level })} />

      <Paper withBorder radius="md" p="md">
        <Group gap="sm" align="flex-end" wrap="wrap" mb="md">
          <TextInput
            aria-label="Tìm theo tên hoặc SKU"
            placeholder="Tìm theo tên hoặc SKU…"
            leftSection={<IconSearch size={16} aria-hidden />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            rightSection={
              search ? (
                <CloseButton size="sm" aria-label="Xóa từ khóa" onClick={() => setSearch('')} />
              ) : null
            }
            style={{ flex: '1 1 240px' }}
          />
          <Select
            aria-label="Mức tồn kho"
            data={LEVEL_OPTIONS}
            value={filters.level}
            onChange={(value) => {
              const level = inventoryFiltersSchema.shape.level.safeParse(value)
              if (level.success) setFilters({ level: level.data })
            }}
            allowDeselect={false}
            w={{ base: '100%', xs: 200 }}
          />
          <Select
            aria-label="Trạng thái bán"
            data={STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => {
              const status = inventoryFiltersSchema.shape.status.safeParse(value)
              if (status.success) setFilters({ status: status.data })
            }}
            allowDeselect={false}
            w={{ base: '100%', xs: 190 }}
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
          <Button
            variant="default"
            leftSection={<IconDownload size={16} aria-hidden />}
            onClick={() => void handleExport()}
            loading={exporting}
            disabled={total === 0}
            ml={{ xs: 'auto' }}
          >
            Xuất CSV
          </Button>
        </Group>

        <div aria-busy={inventory.isFetching}>{renderBody()}</div>

        {inventory.data && total > 0 && (
          <Group justify="space-between" mt="md" gap="sm" wrap="wrap">
            <Text size="sm" c="dimmed">
              Hiển thị {formatNumber(from)}–{formatNumber(to)} trong {formatNumber(total)} sản phẩm
            </Text>
            <Group gap="sm" wrap="wrap">
              <Select
                aria-label="Số sản phẩm mỗi trang"
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
      </Paper>

      <StockAdjustModal item={adjusting} onClose={() => setAdjusting(null)} />
      <MovementHistoryDrawer item={viewingHistory} onClose={() => setViewingHistory(null)} />
    </Stack>
  )
}
