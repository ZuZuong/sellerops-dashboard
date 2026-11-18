import { Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { vndToWords } from '@/shared/lib/vndWords'
import { STOCKTAKE_SIGNERS, type StocktakeSheet } from '../lib/stocktake'

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const
const BLANK_COLUMNS = 5 // SL kiểm kê, TT kiểm kê, thừa, thiếu, ghi chú

const SIGNER_HINTS: Readonly<Record<(typeof STOCKTAKE_SIGNERS)[number], string>> = {
  'Giám đốc': '(Ý kiến giải quyết số chênh lệch — ký, họ tên, đóng dấu)',
  'Kế toán trưởng': '(Ký, họ tên)',
  'Thủ kho': '(Ký, họ tên)',
  'Trưởng ban kiểm kê': '(Ký, họ tên)',
}

interface StocktakeDocumentProps {
  sheet: StocktakeSheet
  /** Thời điểm chốt số liệu sổ sách, đã định dạng. */
  bookAsOf: string
  scopeLabel: string
}

/**
 * Biên bản kiểm kê dạng chứng từ (bố cục theo Mẫu số 05-VT, Thông tư 200/2014/TT-BTC): số liệu theo
 * sổ sách in sẵn; cột theo kiểm kê / chênh lệch / phẩm chất để trống cho ban kiểm kê ghi tay.
 */
export function StocktakeDocument({ sheet, bookAsOf, scopeLabel }: StocktakeDocumentProps) {
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
            Bộ phận: Kho hàng
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" fw={600}>
            Mẫu số 05-VT
          </Text>
          <Text size="xs" c="dimmed" ta="right">
            (Theo Thông tư 200/2014/TT-BTC)
          </Text>
        </Stack>
      </Group>

      <Stack gap={2} align="center" mb="lg">
        <Title order={2} size="h3" ta="center">
          BIÊN BẢN KIỂM KÊ VẬT TƯ, CÔNG CỤ, SẢN PHẨM, HÀNG HÓA
        </Title>
        <Text size="sm">Thời điểm kiểm kê: …… giờ …… ngày …… tháng …… năm ……</Text>
        <Text size="xs" c="dimmed" ta="center">
          Số liệu sổ sách chốt lúc {bookAsOf} · Phạm vi: {scopeLabel}
        </Text>
      </Stack>

      <Stack gap={2} mb="md">
        <Text size="sm">Ban kiểm kê gồm:</Text>
        {['Trưởng ban', 'Ủy viên', 'Ủy viên'].map((role, i) => (
          <Text key={i} size="sm">
            {i + 1}. Ông/Bà ………………………………………… Chức vụ ……………………… Đại diện: {role}
          </Text>
        ))}
        <Text size="sm">Đã kiểm kê kho có những mặt hàng dưới đây:</Text>
      </Stack>

      <Table.ScrollContainer minWidth={980}>
        <Table withTableBorder withColumnBorders verticalSpacing={6} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th rowSpan={2} ta="center" w={36}>
                STT
              </Table.Th>
              <Table.Th rowSpan={2}>Tên hàng hóa</Table.Th>
              <Table.Th rowSpan={2}>Mã số</Table.Th>
              <Table.Th rowSpan={2} ta="center">
                ĐVT
              </Table.Th>
              <Table.Th rowSpan={2} ta="right">
                Đơn giá
              </Table.Th>
              <Table.Th colSpan={2} ta="center">
                Theo sổ sách
              </Table.Th>
              <Table.Th colSpan={2} ta="center">
                Theo kiểm kê
              </Table.Th>
              <Table.Th colSpan={2} ta="center">
                Chênh lệch
              </Table.Th>
              <Table.Th rowSpan={2} ta="center">
                Phẩm chất / Ghi chú
              </Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th ta="right">SL</Table.Th>
              <Table.Th ta="right">Thành tiền</Table.Th>
              <Table.Th ta="right">SL</Table.Th>
              <Table.Th ta="right">Thành tiền</Table.Th>
              <Table.Th ta="center">Thừa</Table.Th>
              <Table.Th ta="center">Thiếu</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sheet.lines.map((line) => (
              <Table.Tr key={line.id}>
                <Table.Td ta="center">{line.index}</Table.Td>
                <Table.Td>{line.name}</Table.Td>
                <Table.Td ff="monospace">{line.sku}</Table.Td>
                <Table.Td ta="center">{line.unit}</Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(line.unitCost)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(line.bookQty)}
                </Table.Td>
                <Table.Td ta="right" style={numeric}>
                  {formatNumber(line.bookAmount)}
                </Table.Td>
                {Array.from({ length: BLANK_COLUMNS }, (_, i) => (
                  <Table.Td key={i} miw={i === BLANK_COLUMNS - 1 ? 110 : 64} />
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={5} ta="center">
                Cộng
              </Table.Th>
              <Table.Td ta="right" style={numeric} fw={600}>
                {formatNumber(sheet.totalQty)}
              </Table.Td>
              <Table.Td ta="right" style={numeric} fw={700}>
                {formatNumber(sheet.totalAmount)}
              </Table.Td>
              {Array.from({ length: BLANK_COLUMNS }, (_, i) => (
                <Table.Td key={i} />
              ))}
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <Text size="sm" mt="sm">
        Tổng giá trị tồn theo sổ sách: <b>{formatCurrency(sheet.totalAmount)}</b> (viết bằng chữ:{' '}
        <i>{vndToWords(sheet.totalAmount)}</i>)
      </Text>
      <Text size="sm" mt={4}>
        Ý kiến giải quyết số chênh lệch: ……………………………………………………………………………………………………
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mt="xl" spacing="md">
        {STOCKTAKE_SIGNERS.map((signer) => (
          <Stack key={signer} gap={0} align="center" mih={100}>
            <Text size="sm" fw={600}>
              {signer}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              {SIGNER_HINTS[signer]}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
    </Paper>
  )
}
