import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useImportProducts } from '../api/products.queries'
import { IMPORT_COLUMNS, type ImportResult } from '../lib/importProducts'
import { previewSku } from '../lib/sku'

interface ProductImportModalProps {
  opened: boolean
  file: File | null
  sheetName: string | null
  result: ImportResult | null
  onClose: () => void
  onDownloadTemplate: () => void
}

/**
 * Popup sau khi chọn file Excel:
 *  - File hợp lệ → danh sách sản phẩm sẽ nhập + chọn "Đăng tất cả" hoặc "Lưu chưa đăng".
 *  - File thiếu / sai dữ liệu → liệt kê lỗi theo cột / dòng để sửa file.
 */
export function ProductImportModal({
  opened,
  file,
  sheetName,
  result,
  onClose,
  onDownloadTemplate,
}: ProductImportModalProps) {
  const isMobile = useMediaQuery('(max-width: 36em)')
  const importProducts = useImportProducts()

  const fileName = file?.name ?? ''

  const handleImport = (publish: boolean) => {
    if (!result?.ok || !file) return
    importProducts.mutate(
      { file, sheetName, rowCount: result.products.length, products: result.products, publish },
      { onSuccess: onClose },
    )
  }

  const busy = importProducts.isPending

  return (
    <Modal
      opened={opened}
      onClose={busy ? () => {} : onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      title={
        result?.ok === false ? 'File Excel chưa đủ dữ liệu' : 'Xem trước sản phẩm nhập từ Excel'
      }
      size="xl"
      fullScreen={isMobile}
      centered
    >
      {result?.ok === false && (
        <Stack gap="md">
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={18} aria-hidden />}
            title={`Không thể nhập "${fileName}"`}
          >
            Sửa các lỗi dưới đây trong file rồi chọn lại. Chưa có sản phẩm nào được lưu.
          </Alert>
          <ScrollArea.Autosize mah={320} type="auto">
            <List size="sm" spacing={4} aria-label="Danh sách lỗi">
              {result.errors.map((error) => (
                <List.Item key={error}>{error}</List.Item>
              ))}
            </List>
          </ScrollArea.Autosize>
          <Text size="sm" c="dimmed">
            Cột bắt buộc:{' '}
            {IMPORT_COLUMNS.filter((c) => c.required)
              .map((c) => c.label)
              .join(', ')}
            . Cột không bắt buộc:{' '}
            {IMPORT_COLUMNS.filter((c) => !c.required)
              .map((c) => c.label)
              .join(', ')}
            . Ảnh không cần có trong file.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              leftSection={<IconDownload size={16} aria-hidden />}
              onClick={onDownloadTemplate}
            >
              Tải file mẫu
            </Button>
            <Button onClick={onClose}>Đóng</Button>
          </Group>
        </Stack>
      )}

      {result?.ok && (
        <Stack gap="md">
          <Text size="sm">
            <Text span fw={600}>
              {formatNumber(result.products.length)} sản phẩm
            </Text>{' '}
            hợp lệ trong file{' '}
            <Text span fw={500}>
              {fileName}
            </Text>
            . SKU được tạo tự động; file gốc được lưu lại trong Lịch sử import.
          </Text>
          {result.warnings.length > 0 && (
            <Alert
              color="orange"
              variant="light"
              icon={<IconAlertTriangle size={18} aria-hidden />}
              title={`${formatNumber(result.warnings.length)} dòng cần xem lại`}
            >
              <ScrollArea.Autosize mah={120} type="auto">
                <List size="sm" spacing={2}>
                  {result.warnings.map((warning) => (
                    <List.Item key={warning}>{warning}</List.Item>
                  ))}
                </List>
              </ScrollArea.Autosize>
            </Alert>
          )}
          <ScrollArea.Autosize mah={420} type="auto">
            <Table striped verticalSpacing="xs" miw={860} stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col">Dòng</Table.Th>
                  <Table.Th scope="col">Tên sản phẩm</Table.Th>
                  <Table.Th scope="col">Danh mục</Table.Th>
                  <Table.Th scope="col">ĐVT</Table.Th>
                  <Table.Th scope="col" ta="right">
                    Giá vốn
                  </Table.Th>
                  <Table.Th scope="col" ta="right">
                    Giá bán
                  </Table.Th>
                  <Table.Th scope="col" ta="right">
                    Tồn đầu kỳ
                  </Table.Th>
                  <Table.Th scope="col">SKU dự kiến</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.products.map((product) => (
                  <Table.Tr key={product.rowNumber}>
                    <Table.Td c="dimmed">{product.rowNumber}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {product.name}
                      </Text>
                      {product.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {product.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="gray" radius="sm">
                        {product.category}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{product.unit}</Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(product.cost_price)}
                    </Table.Td>
                    <Table.Td
                      ta="right"
                      style={{ whiteSpace: 'nowrap' }}
                      c={product.price < product.cost_price ? 'red' : undefined}
                    >
                      {formatCurrency(product.price)}
                    </Table.Td>
                    <Table.Td ta="right">{formatNumber(product.stock)}</Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" c="dimmed">
                        {previewSku(product.name)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          <Group justify="flex-end" gap="sm" wrap="wrap">
            <Button variant="default" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Tooltip
              label="Lưu tất cả sản phẩm nhưng chưa đăng bán"
              events={{ hover: true, focus: true, touch: true }}
            >
              <Button
                variant="light"
                onClick={() => handleImport(false)}
                loading={busy && importProducts.variables?.publish === false}
                disabled={busy}
              >
                Lưu chưa đăng
              </Button>
            </Tooltip>
            <Button
              onClick={() => handleImport(true)}
              loading={busy && importProducts.variables?.publish === true}
              disabled={busy}
            >
              Đăng tất cả
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
