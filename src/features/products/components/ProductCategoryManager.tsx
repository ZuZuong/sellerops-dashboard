import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import { IconCategory, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatNumber } from '@/shared/lib/formatters'
import {
  useCreateProductCategory,
  useDeleteProductCategory,
  useProductCategories,
  useRenameProductCategory,
} from '../api/products.queries'
import { categoryNameSchema } from '../schemas/category.schema'
import type { ProductCategoryOverview } from '../types'

const COLUMNS = 4

/** Lỗi validate tên danh mục (rỗng / quá dài / trùng) — null nếu hợp lệ. */
function validateName(
  value: string,
  categories: readonly ProductCategoryOverview[],
  ignoreId?: string,
): string | null {
  const parsed = categoryNameSchema.safeParse(value)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Tên không hợp lệ'
  const key = parsed.data.toLowerCase()
  const duplicate = categories.some((c) => c.id !== ignoreId && c.name.toLowerCase() === key)
  return duplicate ? 'Đã có danh mục cùng tên' : null
}

/**
 * Quản lý danh mục: thêm, đổi tên, xóa. Xóa danh mục đang có sản phẩm → các sản phẩm đó chuyển
 * về lưu chưa đăng và hiện cảnh báo đỏ ở danh sách sản phẩm cho tới khi chọn lại danh mục.
 */
export function ProductCategoryManager() {
  const categories = useProductCategories()
  const create = useCreateProductCategory()
  const rename = useRenameProductCategory()
  const remove = useDeleteProductCategory()

  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProductCategoryOverview | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ProductCategoryOverview | null>(null)

  const list = categories.data ?? []

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    const error = validateName(newName, list)
    setNewError(error)
    if (error) return
    create.mutate(categoryNameSchema.parse(newName), {
      onSuccess: () => setNewName(''),
    })
  }

  const openRename = (category: ProductCategoryOverview) => {
    setEditing(category)
    setEditName(category.name)
    setEditError(null)
  }

  const handleRename = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const error = validateName(editName, list, editing.id)
    setEditError(error)
    if (error) return
    const name = categoryNameSchema.parse(editName)
    if (name === editing.name) {
      setEditing(null)
      return
    }
    rename.mutate(
      { id: editing.id, name, oldName: editing.name },
      { onSuccess: () => setEditing(null) },
    )
  }

  const handleDelete = () => {
    if (!deleting) return
    remove.mutate({ id: deleting.id, name: deleting.name }, { onSettled: () => setDeleting(null) })
  }

  const renderBody = () => {
    if (categories.isPending) {
      return Array.from({ length: 6 }, (_, i) => (
        <Table.Tr key={i} data-testid="category-row-skeleton">
          {Array.from({ length: COLUMNS }, (_, j) => (
            <Table.Td key={j}>
              <Skeleton height={14} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))
    }
    return list.map((category) => (
      <Table.Tr key={category.id}>
        <Table.Td>
          <Text size="sm" fw={500}>
            {category.name}
          </Text>
        </Table.Td>
        <Table.Td ta="right">{formatNumber(category.product_count)}</Table.Td>
        <Table.Td ta="right">
          {category.active_count > 0 ? (
            <Badge color="green" variant="light" radius="sm">
              {formatNumber(category.active_count)} đang bán
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              0
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label="Đổi tên">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Đổi tên ${category.name}`}
                onClick={() => openRename(category)}
              >
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Xóa danh mục">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Xóa ${category.name}`}
                onClick={() => setDeleting(category)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
    ))
  }

  const deleteMessage = deleting
    ? deleting.product_count === 0
      ? `Danh mục "${deleting.name}" chưa có sản phẩm nào.`
      : `${formatNumber(deleting.product_count)} sản phẩm đang thuộc "${deleting.name}" sẽ bị đánh dấu đỏ "cần cập nhật danh mục"` +
        (deleting.active_count > 0
          ? ` và ${formatNumber(deleting.active_count)} sản phẩm đang bán sẽ tự chuyển về lưu chưa đăng`
          : '') +
        ' cho tới khi bạn chọn lại danh mục cho chúng.'
    : ''

  return (
    <Paper withBorder radius="md" p="md">
      <form onSubmit={handleCreate} noValidate aria-label="Thêm danh mục">
        <Group align="flex-start" gap="sm" mb="md" wrap="wrap">
          <TextInput
            aria-label="Tên danh mục mới"
            placeholder="Tên danh mục mới, vd. Áo hoodie"
            value={newName}
            onChange={(event) => {
              setNewName(event.currentTarget.value)
              if (newError) setNewError(null)
            }}
            error={newError}
            maxLength={60}
            style={{ flex: '1 1 260px' }}
          />
          <Button
            type="submit"
            leftSection={<IconPlus size={16} aria-hidden />}
            loading={create.isPending}
          >
            Thêm danh mục
          </Button>
        </Group>
      </form>

      {categories.isError ? (
        <ErrorState
          message={getErrorMessage(categories.error)}
          onRetry={() => void categories.refetch()}
          retrying={categories.isRefetching}
        />
      ) : categories.data && list.length === 0 ? (
        <EmptyState
          icon={<IconCategory size={24} stroke={1.5} />}
          title="Chưa có danh mục nào"
          description="Thêm danh mục để phân loại sản phẩm. Sản phẩm cần có danh mục mới đăng bán được."
        />
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table verticalSpacing="sm" highlightOnHover aria-busy={categories.isFetching}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Danh mục</Table.Th>
                <Table.Th scope="col" ta="right">
                  Số sản phẩm
                </Table.Th>
                <Table.Th scope="col" ta="right">
                  Đang bán
                </Table.Th>
                <Table.Th scope="col">
                  <VisuallyHidden>Thao tác</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{renderBody()}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={editing !== null}
        onClose={rename.isPending ? () => {} : () => setEditing(null)}
        title="Đổi tên danh mục"
        centered
      >
        <form onSubmit={handleRename} noValidate>
          <Stack gap="md">
            <TextInput
              label="Tên danh mục"
              value={editName}
              onChange={(event) => {
                setEditName(event.currentTarget.value)
                if (editError) setEditError(null)
              }}
              error={editError}
              maxLength={60}
              data-autofocus
              withAsterisk
            />
            {editing && editing.product_count > 0 && (
              <Text size="sm" c="dimmed">
                {formatNumber(editing.product_count)} sản phẩm trong danh mục sẽ đổi theo tên mới.
              </Text>
            )}
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={() => setEditing(null)}
                disabled={rename.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" loading={rename.isPending}>
                Lưu
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ConfirmDialog
        opened={deleting !== null}
        title={`Xóa danh mục "${deleting?.name ?? ''}"?`}
        message={deleteMessage}
        confirmLabel="Xóa danh mục"
        loading={remove.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </Paper>
  )
}
