import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Group,
  Pagination,
  Paper,
  Skeleton,
  Table,
  Text,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import { IconPhoto, IconRestore, IconTrash, IconTrashX, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/lib/formatters'
import { getProductImageUrl } from '../api/productImages.api'
import { usePurgeTrash, useProductTrash, useRestoreProducts } from '../api/products.queries'
import { daysUntilPurge } from '../lib/trash'
import type { TrashedProduct } from '../types'

const PAGE_SIZE = 20
const COLUMNS = 8

/**
 * Thùng rác sản phẩm: khôi phục hoặc xóa vĩnh viễn (từng sản phẩm hoặc nhiều sản phẩm).
 * Sản phẩm tự bị xóa vĩnh viễn sau 30 ngày.
 */
export function ProductTrash() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [purging, setPurging] = useState<readonly TrashedProduct[] | null>(null)
  const trash = useProductTrash(page, PAGE_SIZE)
  const restore = useRestoreProducts()
  const purge = usePurgeTrash()

  const items = trash.data?.items ?? []
  const total = trash.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selectedItems = items.filter((item) => selected.has(item.id))
  const busy = restore.isPending || purge.isPending

  const changePage = (next: number) => {
    setSelected(new Set())
    setPage(next)
  }

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const clearDone = { onSuccess: () => setSelected(new Set()) }
  const handleRestore = (ids: readonly string[]) => restore.mutate(ids, clearDone)
  const handlePurge = () => {
    if (!purging) return
    purge.mutate(
      purging.map((item) => item.id),
      { onSuccess: () => setSelected(new Set()), onSettled: () => setPurging(null) },
    )
  }

  const renderRows = () => {
    if (trash.isPending) {
      return Array.from({ length: 5 }, (_, i) => (
        <Table.Tr key={i} data-testid="trash-row-skeleton">
          {Array.from({ length: COLUMNS }, (_, j) => (
            <Table.Td key={j}>
              <Skeleton height={14} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))
    }
    return items.map((item) => {
      const days = daysUntilPurge(item.purge_at)
      return (
        <Table.Tr
          key={item.id}
          bg={selected.has(item.id) ? 'var(--mantine-primary-color-light)' : undefined}
        >
          <Table.Td>
            <Checkbox
              aria-label={`Chọn ${item.name}`}
              checked={selected.has(item.id)}
              onChange={(event) => toggle(item.id, event.currentTarget.checked)}
            />
          </Table.Td>
          <Table.Td>
            <Text size="sm" ff="monospace">
              {item.sku}
            </Text>
          </Table.Td>
          <Table.Td>
            <Group gap="sm" wrap="nowrap">
              <Avatar
                src={item.hero_image_path ? getProductImageUrl(item.hero_image_path) : null}
                alt=""
                radius="sm"
                size={36}
                color="gray"
              >
                <IconPhoto size={16} stroke={1.5} aria-hidden />
              </Avatar>
              <Text size="sm" fw={500} lineClamp={2} maw={260}>
                {item.name}
              </Text>
            </Group>
          </Table.Td>
          <Table.Td style={{ whiteSpace: 'nowrap' }}>{item.category ?? '—'}</Table.Td>
          <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(item.price)}
          </Table.Td>
          <Table.Td style={{ whiteSpace: 'nowrap' }}>
            <Text size="sm">{formatDateTime(item.deleted_at)}</Text>
          </Table.Td>
          <Table.Td>
            <Badge color={days <= 3 ? 'red' : 'gray'} variant="light" radius="sm">
              {days === 0 ? 'Hôm nay' : `Còn ${formatNumber(days)} ngày`}
            </Badge>
          </Table.Td>
          <Table.Td>
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <Tooltip label="Khôi phục">
                <ActionIcon
                  variant="subtle"
                  aria-label={`Khôi phục ${item.name}`}
                  onClick={() => handleRestore([item.id])}
                  disabled={busy}
                >
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Xóa vĩnh viễn ngay">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Xóa vĩnh viễn ${item.name}`}
                  onClick={() => setPurging([item])}
                  disabled={busy}
                >
                  <IconTrashX size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Table.Td>
        </Table.Tr>
      )
    })
  }

  if (trash.isError) {
    return (
      <Paper withBorder radius="md" p="md">
        <ErrorState
          message={getErrorMessage(trash.error)}
          onRetry={() => void trash.refetch()}
          retrying={trash.isRefetching}
        />
      </Paper>
    )
  }

  if (trash.data && total === 0) {
    return (
      <Paper withBorder radius="md" p="md">
        <EmptyState
          icon={<IconTrash size={24} stroke={1.5} />}
          title="Thùng rác trống"
          description="Sản phẩm bị xóa sẽ nằm ở đây 30 ngày trước khi bị xóa vĩnh viễn."
        />
      </Paper>
    )
  }

  const selectedOnPage = selectedItems.length
  const purgeCount = purging?.length ?? 0

  return (
    <Paper withBorder radius="md" p="md">
      {selectedOnPage > 0 && (
        <Group
          justify="space-between"
          gap="sm"
          wrap="wrap"
          mb="sm"
          p="xs"
          bg="var(--mantine-primary-color-light)"
          style={{ borderRadius: 'var(--mantine-radius-md)' }}
          role="region"
          aria-label="Thao tác với sản phẩm đã chọn"
        >
          <Text size="sm" fw={500}>
            Đã chọn {formatNumber(selectedOnPage)} sản phẩm
          </Text>
          <Group gap="xs">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconX size={14} aria-hidden />}
              onClick={() => setSelected(new Set())}
            >
              Bỏ chọn
            </Button>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconRestore size={14} aria-hidden />}
              onClick={() => handleRestore(selectedItems.map((item) => item.id))}
              loading={restore.isPending}
              disabled={purge.isPending}
            >
              Khôi phục {formatNumber(selectedOnPage)}
            </Button>
            <Button
              color="red"
              size="xs"
              leftSection={<IconTrashX size={14} aria-hidden />}
              onClick={() => setPurging(selectedItems)}
              disabled={restore.isPending}
            >
              Xóa vĩnh viễn {formatNumber(selectedOnPage)}
            </Button>
          </Group>
        </Group>
      )}

      <Table.ScrollContainer minWidth={860}>
        <Table verticalSpacing="sm" highlightOnHover aria-busy={trash.isFetching}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col" w={40}>
                <Checkbox
                  aria-label="Chọn tất cả sản phẩm trên trang"
                  checked={items.length > 0 && selectedOnPage === items.length}
                  indeterminate={selectedOnPage > 0 && selectedOnPage < items.length}
                  onChange={(event) =>
                    setSelected(
                      event.currentTarget.checked
                        ? new Set(items.map((item) => item.id))
                        : new Set(),
                    )
                  }
                />
              </Table.Th>
              <Table.Th scope="col">SKU</Table.Th>
              <Table.Th scope="col">Tên sản phẩm</Table.Th>
              <Table.Th scope="col">Danh mục</Table.Th>
              <Table.Th scope="col" ta="right">
                Giá bán
              </Table.Th>
              <Table.Th scope="col">Ngày xóa</Table.Th>
              <Table.Th scope="col">Xóa vĩnh viễn sau</Table.Th>
              <Table.Th scope="col">
                <VisuallyHidden>Thao tác</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{renderRows()}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {total > PAGE_SIZE && (
        <Group justify="flex-end" mt="md">
          <Pagination
            total={totalPages}
            value={Math.min(page, totalPages)}
            onChange={changePage}
            getControlProps={(control) => ({
              'aria-label': control === 'previous' ? 'Trang trước' : 'Trang sau',
            })}
            getItemProps={(p) => ({ 'aria-label': `Trang ${p}` })}
          />
        </Group>
      )}

      <ConfirmDialog
        opened={purging !== null}
        title={
          purgeCount === 1
            ? 'Xóa vĩnh viễn sản phẩm?'
            : `Xóa vĩnh viễn ${formatNumber(purgeCount)} sản phẩm?`
        }
        message={`${
          purgeCount === 1 ? `"${purging?.[0]?.name}"` : `${formatNumber(purgeCount)} sản phẩm`
        } và ảnh đi kèm sẽ bị xóa ngay, không thể khôi phục. Số thứ tự SKU được trả lại cho sản phẩm tạo tiếp theo.`}
        confirmLabel="Xóa vĩnh viễn"
        loading={purge.isPending}
        onConfirm={handlePurge}
        onClose={() => setPurging(null)}
      />
    </Paper>
  )
}
