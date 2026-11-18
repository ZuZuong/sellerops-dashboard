import { Anchor, Button, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconFileSpreadsheet,
  IconPrinter,
  IconReportMoney,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatNumber } from '@/shared/lib/formatters'
import { downloadXlsx } from '@/shared/lib/xlsxExport'
import { useRevenueReport } from '../api/analytics.queries'
import { useAnalyticsRange } from '../hooks/useAnalyticsRange'
import { buildRevenueReport, revenueReportToXlsx } from '../lib/revenueReport'
import { AnalyticsRangeControl } from './AnalyticsRangeControl'
import { RevenueReportDocument } from './RevenueReportDocument'

/**
 * Trang bảng kê doanh thu: chọn kỳ (dùng chung tham số URL với trang Phân tích) → xem trước →
 * in / lưu PDF hoặc tải Excel để nộp cơ quan thuế, kế toán hay làm báo cáo.
 */
export function RevenueReportView() {
  const { range } = useAnalyticsRange()
  const { search } = useLocation()
  const report = useMemo(() => ({ from: range.from, to: range.to }), [range.from, range.to])
  const query = useRevenueReport(report)
  const [exporting, setExporting] = useState(false)

  const data = useMemo(() => (query.data ? buildRevenueReport(query.data) : null), [query.data])
  // dataUpdatedAt = lúc lấy dữ liệu (chỉ dùng khi đã có dữ liệu).
  const generatedAt = new Date(query.dataUpdatedAt)
  const ready = data !== null && data.rows.length > 0

  const handleExcel = async () => {
    if (!data) return
    setExporting(true)
    try {
      await downloadXlsx(
        `bang-ke-doanh-thu-${report.from}_${report.to}.xlsx`,
        revenueReportToXlsx(data, { companyName: 'SellerOps', range: report, generatedAt }),
      )
      notifications.show({
        color: 'green',
        title: 'Đã xuất bảng kê doanh thu',
        message: `${formatNumber(data.totals.orders)} đơn trong kỳ`,
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
    if (query.isPending) {
      return (
        <Stack gap="sm" aria-busy data-testid="revenue-report-skeleton">
          <Skeleton height={120} radius="md" />
          <Skeleton height={320} radius="md" />
        </Stack>
      )
    }
    if (query.isError) {
      return (
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )
    }
    if (!data || data.rows.length === 0) {
      return (
        <EmptyState
          icon={<IconReportMoney size={24} stroke={1.5} />}
          title="Chưa có doanh thu trong kỳ"
          description="Không có đơn đã xác nhận / đang giao / đã giao trong khoảng ngày đã chọn."
        />
      )
    }
    return <RevenueReportDocument report={data} range={report} generatedAt={generatedAt} />
  }

  return (
    <Stack gap="md">
      <Anchor
        component={Link}
        to={`${ROUTES.analytics}${search}`}
        size="sm"
        c="dimmed"
        data-print-hidden
      >
        <Group gap={4}>
          <IconArrowLeft size={14} aria-hidden />
          Phân tích
        </Group>
      </Anchor>

      <Stack gap="sm" data-print-hidden>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4}>
            <Title order={2}>Bảng kê doanh thu</Title>
            <Text size="sm" c="dimmed">
              Dùng để nộp cơ quan thuế, gửi kế toán hoặc làm báo cáo định kỳ.
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
        <Paper withBorder radius="md" p="md">
          <AnalyticsRangeControl />
        </Paper>
      </Stack>

      <div aria-busy={query.isFetching}>{renderBody()}</div>
    </Stack>
  )
}
