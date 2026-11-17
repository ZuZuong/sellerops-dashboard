import {
  Alert,
  Button,
  Group,
  List,
  Modal,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react'
import { useState } from 'react'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useImportProducts } from '../api/products.queries'
import { IMPORT_COLUMNS, type ImportedRow, type ImportResult } from '../lib/importProducts'

interface ProductImportModalProps {
  opened: boolean
  file: File | null
  sheetName: string | null
  result: ImportResult | null
  /** Dòng trùng tên với sản phẩm đã có (không nhập). `result.products` chỉ còn sản phẩm mới. */
  duplicates?: readonly ImportedRow[]
  onClose: () => void
  onDownloadTemplate: () => void
}

/**
 * Popup sau khi chọn file Excel:
 *  - File hợp lệ → danh sách sản phẩm sẽ nhập; cột "Lưu chưa đăng" có công tắc cho từng dòng
 *    (mặc định tắt = đăng bán ngay). Nút "Đăng tất cả" lưu toàn bộ theo lựa chọn đó.
 *  - File thiếu / sai dữ liệu → liệt kê lỗi theo cột / dòng để sửa file.
 */
export function ProductImportModal({
  opened,
  file,
  sheetName,
  result,
  duplicates = [],
  onClose,
  onDownloadTemplate,
}: ProductImportModalProps) {
  const isMobile = useMediaQuery('(max-width: 36em)')
  const importProducts = useImportProducts()

  // Dòng (rowNumber) chỉ lưu, chưa đăng. Đặt lại khi chọn file khác.
  const [drafts, setDrafts] = useState<ReadonlySet<number>>(() => new Set())
  const [prevResult, setPrevResult] = useState(result)
  if (result !== prevResult) {
    setPrevResult(result)
    setDrafts(new Set())
  }

  const fileName = file?.name ?? ''
  const total = result?.ok ? result.products.length : 0
  const publishCount = total - drafts.size
  const busy = importProducts.isPending

  const toggleDraft = (rowNumber: number, draft: boolean) => {
    setDrafts((current) => {
      const next = new Set(current)
      if (draft) next.add(rowNumber)
      else next.delete(rowNumber)
      return next
    })
  }

  /** Gạt ở tiêu đề: bật = lưu chưa đăng tất cả, tắt = đăng liền tất cả. */
  const toggleAllDrafts = (draft: boolean) => {
    if (!result?.ok) return
    setDrafts(draft ? new Set(result.products.map((p) => p.rowNumber)) : new Set())
  }

  const handleImport = () => {
    if (!result?.ok || !file) return
    importProducts.mutate(
      {
        file,
        sheetName,
        rowCount: result.products.length + duplicates.length,
        products: result.products.map((p) => ({ ...p, publish: !drafts.has(p.rowNumber) })),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal
      opened={opened}
      onClose={busy ? () => {} : onClose}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      title={
        result?.ok === false
          ? 'File Excel chưa đủ dữ liệu'
          : duplicates.length > 0
            ? 'File Excel có sản phẩm trùng tên'
            : 'Xem trước sản phẩm nhập từ Excel'
      }
      // Bảng xem trước cần rộng để thấy đủ cột, không phải cuộn ngang.
      size={result?.ok ? '90rem' : 'xl'}
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

      {result?.ok && duplicates.length > 0 && (
        <Stack gap="md" mb={total > 0 ? 'md' : 0}>
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={18} aria-hidden />}
            title={`${formatNumber(duplicates.length)} sản phẩm trong "${fileName}" đã có trong danh sách`}
          >
            <Text size="sm" mb={4}>
              Các dòng này trùng tên với sản phẩm đã có nên sẽ không được nhập (tránh tạo thêm SKU
              mới cho cùng một sản phẩm):
            </Text>
            <ScrollArea.Autosize mah={140} type="auto">
              <List size="sm" spacing={2} aria-label="Sản phẩm trùng tên">
                {duplicates.map((product) => (
                  <List.Item key={product.rowNumber}>
                    Dòng {product.rowNumber}: {product.name}
                  </List.Item>
                ))}
              </List>
            </ScrollArea.Autosize>
          </Alert>
          {total === 0 ? (
            <>
              <Text size="sm">
                Tất cả sản phẩm trong file đều đã có, không có sản phẩm mới để thêm.
              </Text>
              <Group justify="flex-end">
                <Button onClick={onClose}>Đóng</Button>
              </Group>
            </>
          ) : (
            <Text size="sm" fw={600}>
              Còn {formatNumber(total)} sản phẩm mới chưa có. Bạn có muốn thêm ngay các sản phẩm mới
              này không?
            </Text>
          )}
        </Stack>
      )}

      {result?.ok && total > 0 && (
        <Stack gap="md">
          <Text size="sm">
            <Text span fw={600}>
              {formatNumber(result.products.length)} sản phẩm
            </Text>{' '}
            hợp lệ trong file{' '}
            <Text span fw={500}>
              {fileName}
            </Text>
            . SKU được tạo tự động; file gốc được lưu lại trong Lịch sử import. Gạt lên ở cột{' '}
            <Text span fw={500}>
              Lưu chưa đăng
            </Text>{' '}
            = lưu nhưng chưa đăng; để nguyên = đăng bán liền. Gạt ở tiêu đề cột áp dụng cho tất cả.
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
          <ScrollArea.Autosize mah="calc(100dvh - 20rem)" mih={240} type="auto">
            <Table striped verticalSpacing="xs" miw={760} stickyHeader>
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
                    Số lượng
                  </Table.Th>
                  <Table.Th scope="col" style={{ whiteSpace: 'nowrap' }}>
                    <Stack gap={4} align="center">
                      Lưu chưa đăng
                      <Switch
                        size="sm"
                        aria-label="Lưu chưa đăng tất cả sản phẩm"
                        checked={total > 0 && drafts.size === total}
                        onChange={(event) => toggleAllDrafts(event.currentTarget.checked)}
                        disabled={busy}
                      />
                    </Stack>
                  </Table.Th>
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
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{product.category}</Table.Td>
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
                      <Group justify="center">
                        <Switch
                          size="sm"
                          aria-label={`Lưu chưa đăng ${product.name}`}
                          checked={drafts.has(product.rowNumber)}
                          onChange={(event) =>
                            toggleDraft(product.rowNumber, event.currentTarget.checked)
                          }
                          disabled={busy}
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          <Group justify="space-between" gap="sm" wrap="wrap">
            <Text size="sm" c="dimmed" aria-live="polite">
              Đăng {formatNumber(publishCount)} · lưu chưa đăng {formatNumber(drafts.size)}
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button variant="default" onClick={onClose} disabled={busy}>
                Hủy
              </Button>
              <Button onClick={handleImport} loading={busy}>
                {duplicates.length > 0 ? `Thêm ${formatNumber(total)} sản phẩm mới` : 'Đăng tất cả'}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
