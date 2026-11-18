import { Alert, Anchor, Button, Group, Select, Skeleton, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClipboardList,
  IconFileSpreadsheet,
  IconPrinter,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useProductCategoryNames } from '@/features/products'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { ROUTES } from '@/shared/constants/routes'
import { useUrlState } from '@/shared/hooks/useUrlState'
import { todayKey } from '@/shared/lib/dates'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatDateTime, formatNumber } from '@/shared/lib/formatters'
import { downloadXlsx } from '@/shared/lib/xlsxExport'
import { EXPORT_LIMIT } from '../api/inventory.api'
import { useStocktakeItems } from '../api/inventory.queries'
import { buildStocktakeSheet, stocktakeToXlsx } from '../lib/stocktake'
import { describeStocktakeScope, stocktakeScopeSchema } from '../schemas/stocktakeScope.schema'
import { StocktakeDocument } from './StocktakeDocument'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả sản phẩm' },
  { value: 'active', label: 'Chỉ sản phẩm đang bán' },
]

/**
 * Trang biên bản kiểm kê: chọn phạm vi → xem trước chứng từ → in (hoặc lưu PDF) / tải Excel để
 * ban kiểm kê ghi số đếm thực tế. Không thay đổi tồn kho; chênh lệch xử lý sau bằng "Điều chỉnh kho".
 */
export function StocktakeView() {
  const { state: scope, setState } = useUrlState(stocktakeScopeSchema)
  const stocktake = useStocktakeItems(scope)
  const categories = useProductCategoryNames()
  const [exporting, setExporting] = useState(false)

  const sheet = useMemo(
    () => (stocktake.data ? buildStocktakeSheet(stocktake.data.items) : null),
    [stocktake.data],
  )
  const bookAsOf = formatDateTime(new Date(stocktake.dataUpdatedAt))
  const scopeLabel = describeStocktakeScope(scope)

  const handleExcel = async () => {
    if (!sheet) return
    setExporting(true)
    try {
      await downloadXlsx(`bien-ban-kiem-ke-${todayKey()}.xlsx`, [
        stocktakeToXlsx(sheet, { companyName: 'SellerOps', bookAsOf, scopeLabel }),
      ])
      notifications.show({
        color: 'green',
        title: 'Đã xuất biên bản kiểm kê',
        message: `${formatNumber(sheet.lines.length)} mặt hàng — nhập cột "SL kiểm kê", file tự tính chênh lệch.`,
      })
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Không xuất được file Excel',
        message: getErrorMessage(error),
      })
    } finally {
      setExporting(false)
    }
  }

  const renderBody = () => {
    if (stocktake.isPending) {
      return (
        <Stack gap="sm" aria-busy data-testid="stocktake-skeleton">
          <Skeleton height={60} radius="md" />
          <Skeleton height={320} radius="md" />
        </Stack>
      )
    }
    if (stocktake.isError) {
      return (
        <ErrorState
          message={getErrorMessage(stocktake.error)}
          onRetry={() => void stocktake.refetch()}
          retrying={stocktake.isRefetching}
        />
      )
    }
    if (!sheet || sheet.lines.length === 0) {
      return (
        <EmptyState
          icon={<IconClipboardList size={24} stroke={1.5} />}
          title="Không có sản phẩm để kiểm kê"
          description="Phạm vi đang chọn không có sản phẩm nào. Thử chọn tất cả sản phẩm hoặc danh mục khác."
        />
      )
    }
    return (
      <Stack gap="sm">
        {stocktake.data.truncated && (
          <Alert
            color="orange"
            variant="light"
            icon={<IconAlertTriangle size={18} aria-hidden />}
            data-print-hidden
          >
            Chỉ lấy {formatNumber(EXPORT_LIMIT)} sản phẩm đầu tiên. Hãy kiểm kê theo từng danh mục.
          </Alert>
        )}
        <StocktakeDocument sheet={sheet} bookAsOf={bookAsOf} scopeLabel={scopeLabel} />
      </Stack>
    )
  }

  const ready = sheet !== null && sheet.lines.length > 0

  return (
    <Stack gap="md">
      <Anchor component={Link} to={ROUTES.inventory} size="sm" c="dimmed" data-print-hidden>
        <Group gap={4}>
          <IconArrowLeft size={14} aria-hidden />
          Kho hàng
        </Group>
      </Anchor>

      <Stack gap="sm" data-print-hidden>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4}>
            <Title order={2}>Biên bản kiểm kê kho</Title>
            <Text size="sm" c="dimmed">
              In ra cho ban kiểm kê ghi số đếm thực tế, hoặc tải Excel để nhập trên máy.
            </Text>
          </Stack>
          <Group gap="sm">
            <Button
              variant="default"
              leftSection={<IconFileSpreadsheet size={16} aria-hidden />}
              onClick={() => void handleExcel()}
              loading={exporting}
              disabled={!ready}
            >
              Tải Excel
            </Button>
            <Button
              leftSection={<IconPrinter size={16} aria-hidden />}
              onClick={() => window.print()}
              disabled={!ready}
            >
              In / Lưu PDF
            </Button>
          </Group>
        </Group>
        <Group gap="sm" wrap="wrap">
          <Select
            aria-label="Phạm vi sản phẩm"
            data={STATUS_OPTIONS}
            value={scope.status}
            onChange={(value) => {
              const status = stocktakeScopeSchema.shape.status.safeParse(value)
              if (status.success) setState({ status: status.data }, { replace: true })
            }}
            allowDeselect={false}
            w={{ base: '100%', xs: 220 }}
          />
          <Select
            aria-label="Danh mục"
            placeholder="Tất cả danh mục"
            data={categories.data ?? []}
            value={scope.category || null}
            onChange={(value) => setState({ category: value ?? '' }, { replace: true })}
            clearable
            searchable
            nothingFoundMessage="Không có danh mục phù hợp"
            w={{ base: '100%', xs: 220 }}
          />
        </Group>
      </Stack>

      <div aria-busy={stocktake.isFetching}>{renderBody()}</div>
    </Stack>
  )
}
