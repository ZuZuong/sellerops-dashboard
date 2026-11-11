import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconFileSpreadsheet, IconList } from '@tabler/icons-react'
import { useState } from 'react'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import {
  formatCurrency,
  formatDateTime,
  formatFileSize,
  formatNumber,
} from '@/shared/lib/formatters'
import { getImportFileUrl } from '../api/productImports.api'
import { useImportedProducts, useProductImports } from '../api/products.queries'
import type { ProductImport } from '../types'

const PAGE_SIZE = 10
const COLUMNS = 7

/**
 * Lịch sử nhập sản phẩm từ Excel: thông tin file gốc (tên, dung lượng, sheet, số dòng), kết quả,
 * tải lại file đã nhập và xem danh sách sản phẩm được tạo từ lần nhập đó.
 */
export function ProductImportHistory() {
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<ProductImport | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const imports = useProductImports(page, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil((imports.data?.total ?? 0) / PAGE_SIZE))

  const download = async (item: ProductImport) => {
    setDownloading(item.id)
    try {
      window.location.assign(await getImportFileUrl(item))
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Không tải được file',
        message: getErrorMessage(error),
      })
    } finally {
      setDownloading(null)
    }
  }

  const renderRows = () => {
    if (imports.isPending) {
      return Array.from({ length: 5 }, (_, i) => (
        <Table.Tr key={i} data-testid="import-row-skeleton">
          {Array.from({ length: COLUMNS }, (_, j) => (
            <Table.Td key={j}>
              <Skeleton height={14} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))
    }
    if (!imports.data) return null
    return imports.data.items.map((item) => (
      <Table.Tr key={item.id}>
        <Table.Td style={{ whiteSpace: 'nowrap' }}>
          <Text size="sm">{formatDateTime(item.created_at)}</Text>
        </Table.Td>
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            <IconFileSpreadsheet
              size={18}
              stroke={1.5}
              aria-hidden
              color="var(--mantine-color-green-7)"
            />
            <Stack gap={0} miw={0}>
              <Text size="sm" fw={500} lineClamp={1} maw={280} title={item.file_name}>
                {item.file_name}
              </Text>
              <Text size="xs" c="dimmed">
                {formatFileSize(item.file_size)}
                {item.sheet_name ? ` · sheet "${item.sheet_name}"` : ''}
              </Text>
            </Stack>
          </Group>
        </Table.Td>
        <Table.Td ta="right">{formatNumber(item.row_count)}</Table.Td>
        <Table.Td ta="right">{formatNumber(item.imported_count)}</Table.Td>
        <Table.Td>
          <Badge color={item.published ? 'green' : 'gray'} variant="light" radius="sm">
            {item.published ? 'Đăng bán ngay' : 'Lưu chưa đăng'}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Badge color="teal" variant="dot" radius="sm">
            Thành công
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label="Xem sản phẩm đã tạo">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Xem sản phẩm từ ${item.file_name}`}
                onClick={() => setViewing(item)}
              >
                <IconList size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Tải file gốc">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Tải file ${item.file_name}`}
                loading={downloading === item.id}
                onClick={() => void download(item)}
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
    ))
  }

  const renderBody = () => {
    if (imports.isError) {
      return (
        <ErrorState
          message={getErrorMessage(imports.error)}
          onRetry={() => void imports.refetch()}
          retrying={imports.isRefetching}
        />
      )
    }
    if (imports.data && imports.data.total === 0) {
      return (
        <EmptyState
          icon={<IconFileSpreadsheet size={24} stroke={1.5} />}
          title="Chưa có lần nhập nào"
          description='Dùng nút "Nhập từ Excel" ở trang Sản phẩm. Mỗi lần nhập, file gốc được lưu lại tại đây.'
        />
      )
    }
    return (
      <Table.ScrollContainer minWidth={820}>
        <Table verticalSpacing="sm" aria-busy={imports.isFetching}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Thời gian</Table.Th>
              <Table.Th scope="col">File</Table.Th>
              <Table.Th scope="col" ta="right">
                Số dòng
              </Table.Th>
              <Table.Th scope="col" ta="right">
                Đã tạo
              </Table.Th>
              <Table.Th scope="col">Chế độ</Table.Th>
              <Table.Th scope="col">Kết quả</Table.Th>
              <Table.Th scope="col">
                <VisuallyHidden>Thao tác</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{renderRows()}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    )
  }

  return (
    <Paper withBorder radius="md" p="md">
      {renderBody()}
      {totalPages > 1 && (
        <Group justify="flex-end" mt="md">
          <Pagination
            total={totalPages}
            value={Math.min(page, totalPages)}
            onChange={setPage}
            getControlProps={(control) => ({
              'aria-label': control === 'previous' ? 'Trang trước' : 'Trang sau',
            })}
            getItemProps={(p) => ({ 'aria-label': `Trang ${p}` })}
          />
        </Group>
      )}
      <Drawer
        opened={viewing !== null}
        onClose={() => setViewing(null)}
        position="right"
        size="lg"
        title="Sản phẩm từ lần nhập"
      >
        {viewing && <ImportedProducts item={viewing} onDownload={() => void download(viewing)} />}
      </Drawer>
    </Paper>
  )
}

function ImportedProducts({ item, onDownload }: { item: ProductImport; onDownload: () => void }) {
  const products = useImportedProducts(item.id)

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="sm">
        <Text size="sm" fw={600}>
          {item.file_name}
        </Text>
        <Text size="xs" c="dimmed">
          {formatDateTime(item.created_at)} · {formatFileSize(item.file_size)} ·{' '}
          {formatNumber(item.imported_count)} sản phẩm
        </Text>
        <Button
          mt="xs"
          size="xs"
          variant="light"
          leftSection={<IconDownload size={14} aria-hidden />}
          onClick={onDownload}
        >
          Tải file gốc
        </Button>
      </Paper>

      {products.isPending ? (
        <Stack gap="xs" aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={32} />
          ))}
        </Stack>
      ) : products.isError ? (
        <ErrorState
          message={getErrorMessage(products.error)}
          onRetry={() => void products.refetch()}
          retrying={products.isRefetching}
        />
      ) : products.data.length === 0 ? (
        <EmptyState
          title="Không còn sản phẩm nào"
          description="Các sản phẩm của lần nhập này đã bị xóa."
        />
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Sản phẩm</Table.Th>
                <Table.Th scope="col" ta="right">
                  Giá vốn
                </Table.Th>
                <Table.Th scope="col" ta="right">
                  Giá bán
                </Table.Th>
                <Table.Th scope="col" ta="right">
                  Tồn
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {products.data.map((product) => (
                <Table.Tr key={product.id}>
                  <Table.Td>
                    <Text size="sm" fw={500} lineClamp={1}>
                      {product.name}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {product.sku}
                      {product.is_active ? '' : ' · chưa đăng'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(product.cost_price)}
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {formatCurrency(product.price)}
                  </Table.Td>
                  <Table.Td ta="right">
                    {formatNumber(product.stock)} {product.unit}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  )
}
