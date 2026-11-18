import { Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { getPaymentMethodLabel } from '@/features/orders'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/shared/lib/formatters'
import { vndToWords } from '@/shared/lib/vndWords'
import {
  orderDateKey,
  REVENUE_RECOGNITION_NOTE,
  REVENUE_REPORT_SIGNERS,
  type RevenueGroup,
  type RevenueReport,
} from '../lib/revenueReport'
import type { ReportRange } from '../types'

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

interface RevenueReportDocumentProps {
  report: RevenueReport
  range: ReportRange
  generatedAt: Date
}

/**
 * Bảng kê doanh thu dạng chứng từ để in / lưu PDF: tổng hợp kỳ, theo hình thức thanh toán, bảng kê
 * từng đơn (số chứng từ = mã đơn), số tiền bằng chữ và chỗ ký.
 */
export function RevenueReportDocument({ report, range, generatedAt }: RevenueReportDocumentProps) {
  const { totals } = report
  return (
    <Paper
      withBorder
      radius="md"
      p={{ base: 'md', sm: 'xl' }}
      className="print-sheet print-landscape"
    >
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            SellerOps
          </Text>
          <Text size="xs" c="dimmed">
            Bộ phận: Kế toán – Bán hàng
          </Text>
        </Stack>
        <Text size="xs" c="dimmed" ta="right">
          Lập lúc {formatDateTime(generatedAt)}
        </Text>
      </Group>

      <Stack gap={2} align="center" mb="lg">
        <Title order={2} size="h3" ta="center">
          BẢNG KÊ DOANH THU BÁN HÀNG HÓA
        </Title>
        <Text size="sm">
          Kỳ báo cáo: từ ngày {formatDate(range.from)} đến ngày {formatDate(range.to)}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mb="md">
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            I. Tổng hợp
          </Text>
          <SummaryRow label="Số đơn ghi nhận doanh thu" value={formatNumber(totals.orders)} />
          <SummaryRow label="Số lượng hàng bán" value={formatNumber(totals.quantity)} />
          <SummaryRow label="Tổng doanh thu" value={formatCurrency(totals.revenue)} strong />
          <SummaryRow label="Giá vốn hàng bán" value={formatCurrency(totals.cogs)} />
          <SummaryRow label="Lãi gộp" value={formatCurrency(totals.grossProfit)} />
        </Stack>
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            II. Theo hình thức thanh toán
          </Text>
          {report.byPayment.map((group: RevenueGroup) => (
            <SummaryRow
              key={group.key}
              label={`${group.label} (${formatNumber(group.orders)} đơn)`}
              value={formatCurrency(group.revenue)}
            />
          ))}
        </Stack>
      </SimpleGrid>

      <Text size="sm" fw={600} mb={4}>
        III. Bảng kê chi tiết
      </Text>
      <Table.ScrollContainer minWidth={900}>
        <Table withTableBorder withColumnBorders verticalSpacing={4} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th ta="center" w={36}>
                STT
              </Table.Th>
              <Table.Th>Ngày chứng từ</Table.Th>
              <Table.Th>Số chứng từ</Table.Th>
              <Table.Th>Khách hàng</Table.Th>
              <Table.Th>Hình thức TT</Table.Th>
              <Table.Th ta="right">SL</Table.Th>
              <Table.Th ta="right">Doanh thu</Table.Th>
              <Table.Th ta="right">Giá vốn</Table.Th>
              <Table.Th ta="right">Lãi gộp</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {report.rows.map((row, i) => (
              <Table.Tr key={row.order_id}>
                <Table.Td ta="center">{i + 1}</Table.Td>
                <Table.Td style={numeric}>{formatDate(orderDateKey(row))}</Table.Td>
                <Table.Td ff="monospace" style={numeric}>
                  {row.code}
                </Table.Td>
                <Table.Td>{row.customer_name}</Table.Td>
                <Table.Td>{getPaymentMethodLabel(row.payment_method)}</Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(row.quantity)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(row.revenue)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(row.cogs)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(row.revenue - row.cogs)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={5} ta="center">
                Cộng
              </Table.Th>
              <Table.Td ta="right" style={numeric} fw={600}>
                {formatNumber(totals.quantity)}
              </Table.Td>
              <Table.Td ta="right" style={numeric} fw={700}>
                {formatNumber(totals.revenue)}
              </Table.Td>
              <Table.Td ta="right" style={numeric} fw={600}>
                {formatNumber(totals.cogs)}
              </Table.Td>
              <Table.Td ta="right" style={numeric} fw={600}>
                {formatNumber(totals.grossProfit)}
              </Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <Text size="sm" mt="sm">
        Tổng doanh thu (viết bằng chữ): <i>{vndToWords(totals.revenue)}</i>
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        Ghi chú: {REVENUE_RECOGNITION_NOTE}
      </Text>

      <SimpleGrid cols={{ base: 1, xs: 3 }} mt="xl" spacing="md">
        {REVENUE_REPORT_SIGNERS.map((signer, i) => (
          <Stack key={signer} gap={0} align="center" mih={100}>
            {i === REVENUE_REPORT_SIGNERS.length - 1 && (
              <Text size="xs" fs="italic">
                Ngày …… tháng …… năm ……
              </Text>
            )}
            <Text size="sm" fw={600} ta="center">
              {signer}
            </Text>
            <Text size="xs" c="dimmed">
              {i === REVENUE_REPORT_SIGNERS.length - 1 ? '(Ký, họ tên, đóng dấu)' : '(Ký, họ tên)'}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
    </Paper>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap">
      <Text size="sm">{label}</Text>
      <Text size="sm" fw={strong ? 700 : 500} style={numeric}>
        {value}
      </Text>
    </Group>
  )
}
