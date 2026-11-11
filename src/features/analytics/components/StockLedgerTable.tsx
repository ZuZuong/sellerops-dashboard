import { Button, Skeleton, Stack, Table, Text } from '@mantine/core'
import { IconBuildingWarehouse, IconDownload } from '@tabler/icons-react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { WidgetCard } from '@/shared/components/WidgetCard'
import { downloadCsv } from '@/shared/lib/csv'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useStockLedger } from '../api/analytics.queries'
import { stockLedgerToCsv, stockLedgerTotals } from '../lib/analytics'
import type { ReportRange, StockLedgerRow } from '../types'

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

/**
 * Báo cáo xuất nhập tồn: với mỗi sản phẩm — tồn đầu kỳ, nhập trong kỳ (phiếu nhập, hoàn kho do
 * hủy đơn, điều chỉnh tăng), xuất trong kỳ (bán, điều chỉnh giảm), tồn cuối kỳ; số lượng và giá trị
 * theo giá vốn. Tính từ lịch sử biến động kho (inventory_movements).
 */
export function StockLedgerTable({ range }: { range: ReportRange }) {
  const ledger = useStockLedger(range)
  const rows = ledger.data

  return (
    <WidgetCard
      title="Báo cáo xuất nhập tồn"
      actions={
        <Button
          size="xs"
          variant="default"
          leftSection={<IconDownload size={14} aria-hidden />}
          disabled={!rows || rows.length === 0}
          onClick={() =>
            rows &&
            downloadCsv(`xuat-nhap-ton_${range.from}_${range.to}.csv`, stockLedgerToCsv(rows))
          }
        >
          Xuất CSV
        </Button>
      }
    >
      {ledger.isPending ? (
        <Stack gap="xs" aria-busy data-testid="stock-ledger-skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={28} />
          ))}
        </Stack>
      ) : ledger.isError ? (
        <ErrorState
          message={getErrorMessage(ledger.error)}
          onRetry={() => void ledger.refetch()}
          retrying={ledger.isRefetching}
        />
      ) : ledger.data.length === 0 ? (
        <EmptyState
          icon={<IconBuildingWarehouse size={24} stroke={1.5} />}
          title="Không có biến động kho"
          description="Chưa có hàng tồn hoặc nhập / xuất trong khoảng thời gian này."
        />
      ) : (
        <LedgerTable rows={ledger.data} busy={ledger.isPlaceholderData} />
      )}
    </WidgetCard>
  )
}

function QtyValue({ qty, value, unit }: { qty: number; value: number; unit?: string }) {
  return (
    <>
      <Text size="sm">
        {formatNumber(qty)}
        {unit ? ` ${unit}` : ''}
      </Text>
      <Text size="xs" c="dimmed">
        {formatCurrency(value)}
      </Text>
    </>
  )
}

function LedgerTable({ rows, busy }: { rows: StockLedgerRow[]; busy: boolean }) {
  const totals = stockLedgerTotals(rows)
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table verticalSpacing="xs" striped aria-busy={busy}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Sản phẩm</Table.Th>
            <Table.Th scope="col" ta="right">
              Tồn đầu kỳ
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Nhập trong kỳ
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Xuất trong kỳ
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Tồn cuối kỳ
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.product_id}>
              <Table.Td>
                <Text size="sm" fw={500} lineClamp={1}>
                  {row.name}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {row.sku}
                </Text>
              </Table.Td>
              <Table.Td ta="right" style={numeric}>
                <QtyValue qty={row.opening_qty} value={row.opening_value} unit={row.unit} />
              </Table.Td>
              <Table.Td ta="right" style={numeric}>
                <QtyValue qty={row.in_qty} value={row.in_value} />
              </Table.Td>
              <Table.Td ta="right" style={numeric}>
                <QtyValue qty={row.out_qty} value={row.out_value} />
              </Table.Td>
              <Table.Td ta="right" style={numeric}>
                <QtyValue qty={row.closing_qty} value={row.closing_value} unit={row.unit} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th scope="row">Cộng giá trị ({formatNumber(rows.length)} sản phẩm)</Table.Th>
            <Table.Td ta="right" style={numeric} fw={600}>
              {formatCurrency(totals.opening_value)}
            </Table.Td>
            <Table.Td ta="right" style={numeric} fw={600}>
              {formatCurrency(totals.in_value)}
            </Table.Td>
            <Table.Td ta="right" style={numeric} fw={600}>
              {formatCurrency(totals.out_value)}
            </Table.Td>
            <Table.Td ta="right" style={numeric} fw={600}>
              {formatCurrency(totals.closing_value)}
            </Table.Td>
          </Table.Tr>
        </Table.Tfoot>
      </Table>
    </Table.ScrollContainer>
  )
}
