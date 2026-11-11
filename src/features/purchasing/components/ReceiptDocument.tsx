import { Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/shared/lib/formatters'
import { vndToWords } from '@/shared/lib/vndWords'
import { lineAmount, receiptTotals, shortageQty } from '../domain/costing'
import type { ReceiptDetail } from '../types'

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

const SIGNERS = ['Người lập phiếu', 'Người giao hàng', 'Thủ kho', 'Kế toán trưởng']

/**
 * Phiếu nhập kho dạng chứng từ (bố cục theo Mẫu số 01-VT, Thông tư 200/2014/TT-BTC):
 * số phiếu, ngày, người giao, chứng từ gốc, bảng hàng (SL theo chứng từ / thực nhập),
 * tổng tiền bằng số và bằng chữ, chữ ký. In trực tiếp từ trình duyệt.
 */
export function ReceiptDocument({ receipt }: { receipt: ReceiptDetail }) {
  const totals = receiptTotals(receipt.items)
  const hasDefects = totals.defective > 0

  return (
    <Paper withBorder radius="md" p={{ base: 'md', sm: 'xl' }} className="print-sheet">
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            SellerOps
          </Text>
          <Text size="xs" c="dimmed">
            Bộ phận: Kho hàng
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" fw={600}>
            Mẫu số 01-VT
          </Text>
          <Text size="xs" c="dimmed" ta="right">
            (Theo Thông tư 200/2014/TT-BTC)
          </Text>
        </Stack>
      </Group>

      <Stack gap={2} align="center" mb="lg">
        <Title order={2} size="h3">
          PHIẾU NHẬP KHO
        </Title>
        <Text size="sm">Ngày {formatDate(receipt.received_date)}</Text>
        <Text size="sm">
          Số: <b>{receipt.code}</b>
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={4} mb="md">
        <Text size="sm">
          Nhà cung cấp: <b>{receipt.supplier_name}</b>
          {receipt.supplier_phone ? ` · ${receipt.supplier_phone}` : ''}
        </Text>
        <Text size="sm">Họ tên người giao: {receipt.delivered_by ?? '…………………………'}</Text>
        <Text size="sm">Theo hóa đơn / chứng từ số: {receipt.invoice_number ?? '…………'}</Text>
        <Text size="sm">Nhập tại kho: Kho chính</Text>
        {receipt.note && (
          <Text size="sm" style={{ gridColumn: '1 / -1' }}>
            Ghi chú: {receipt.note}
          </Text>
        )}
      </SimpleGrid>

      <Table.ScrollContainer minWidth={760}>
        <Table withTableBorder withColumnBorders verticalSpacing={6} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th rowSpan={2} ta="center" w={40}>
                STT
              </Table.Th>
              <Table.Th rowSpan={2}>Tên hàng hóa · Mã số</Table.Th>
              <Table.Th rowSpan={2} ta="center">
                ĐVT
              </Table.Th>
              <Table.Th colSpan={hasDefects ? 3 : 2} ta="center">
                Số lượng
              </Table.Th>
              <Table.Th rowSpan={2} ta="right">
                Đơn giá
              </Table.Th>
              <Table.Th rowSpan={2} ta="right">
                Thành tiền
              </Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th ta="right">Theo chứng từ</Table.Th>
              <Table.Th ta="right">Thực nhập</Table.Th>
              {hasDefects && <Table.Th ta="right">Lỗi</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {receipt.items.map((item, index) => (
              <Table.Tr key={item.id}>
                <Table.Td ta="center">{index + 1}</Table.Td>
                <Table.Td>
                  <Text size="sm">{item.product?.name ?? 'Sản phẩm đã xóa'}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {item.product?.sku}
                  </Text>
                  {(item.condition_note || shortageQty(item) > 0) && (
                    <Text size="xs" c="dimmed" fs="italic">
                      {[
                        item.condition_note,
                        shortageQty(item) > 0 ? `thiếu ${formatNumber(shortageQty(item))}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="center">{item.product?.unit ?? ''}</Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(item.ordered_qty)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(item.received_qty)}
                </Table.Td>
                {hasDefects && (
                  <Table.Td ta="right" style={numeric}>
                    {item.defective_qty > 0 ? formatNumber(item.defective_qty) : ''}
                  </Table.Td>
                )}
                <Table.Td ta="right" style={numeric}>
                  {formatCurrency(item.unit_cost)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatCurrency(lineAmount(item))}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={3} ta="center">
                Cộng
              </Table.Th>
              <Table.Td ta="right" style={numeric} fw={600}>
                {formatNumber(totals.ordered)}
              </Table.Td>
              <Table.Td ta="right" style={numeric} fw={600}>
                {formatNumber(totals.received)}
              </Table.Td>
              {hasDefects && (
                <Table.Td ta="right" style={numeric} fw={600}>
                  {formatNumber(totals.defective)}
                </Table.Td>
              )}
              <Table.Td />
              <Table.Td ta="right" style={numeric} fw={700}>
                {formatCurrency(receipt.total_amount)}
              </Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <Text size="sm" mt="sm">
        Tổng số tiền (viết bằng chữ): <i>{vndToWords(receipt.total_amount)}</i>
      </Text>
      {receipt.posted_at && (
        <Text size="xs" c="dimmed" mt={4}>
          Đã nhập kho lúc {formatDateTime(receipt.posted_at)}. Hàng lỗi không được nhập kho.
        </Text>
      )}

      <SimpleGrid cols={{ base: 2, sm: 4 }} mt="xl" spacing="md">
        {SIGNERS.map((signer) => (
          <Stack key={signer} gap={0} align="center" mih={90}>
            <Text size="sm" fw={600}>
              {signer}
            </Text>
            <Text size="xs" c="dimmed">
              (Ký, họ tên)
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
    </Paper>
  )
}
