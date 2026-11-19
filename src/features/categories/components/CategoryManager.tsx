import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconCategory,
  IconEdit,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { useSellerScope } from '@/shared/hooks/useSellerScope'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatNumber } from '@/shared/lib/formatters'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from '../api/categories.queries'
import { categoryNameSchema, validateCategoryName } from '../schemas/category.schema'
import { moveItem } from '../lib/moveItem'
import type { CategoryOverview } from '../types'

interface CategoryManagerProps {
  /**
   * Hiện cột số sản phẩm (trang Danh mục). Bước 3 hồ sơ ẩn đi vì shop chưa có sản phẩm nào.
   */
  showProductCounts?: boolean
}

/**
 * Quản lý danh mục của shop: thêm, đổi tên, đổi thứ tự, xóa. Dùng chung cho bước 3 hồ sơ đăng ký
 * và trang /seller/categories. Xóa danh mục đang có sản phẩm → bắt buộc chọn danh mục để chuyển
 * sản phẩm sang (database chặn lại nếu thiếu). Khi xem ở chế độ chỉ đọc, mọi nút ghi bị ẩn.
 */
export function CategoryManager({ showProductCounts = true }: CategoryManagerProps) {
  const { readOnly } = useSellerScope()
  const categories = useCategories()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const reorder = useReorderCategories()
  const remove = useDeleteCategory()

  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CategoryOverview | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CategoryOverview | null>(null)
  const [moveToId, setMoveToId] = useState<string | null>(null)

  const list = categories.data ?? []
  const columns = (showProductCounts ? 3 : 1) + (readOnly ? 0 : 1)

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    const error = validateCategoryName(newName, list)
    setNewError(error)
    if (error) return
    create.mutate(categoryNameSchema.parse(newName), { onSuccess: () => setNewName('') })
  }

  const openRename = (category: CategoryOverview) => {
    setEditing(category)
    setEditName(category.name)
    setEditError(null)
  }

  const handleRename = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const error = validateCategoryName(editName, list, editing.id)
    setEditError(error)
    if (error) return
    const name = categoryNameSchema.parse(editName)
    if (name === editing.name) {
      setEditing(null)
      return
    }
    update.mutate({ category: editing, name }, { onSuccess: () => setEditing(null) })
  }

  const openDelete = (category: CategoryOverview) => {
    setDeleting(category)
    setMoveToId(null)
  }

  const moveTargets = deleting
    ? list.filter((c) => c.id !== deleting.id).map((c) => ({ value: c.id, label: c.name }))
    : []
  const needsMoveTarget = (deleting?.product_count ?? 0) > 0
  const moveTo = moveTargets.find((option) => option.value === moveToId) ?? null

  const handleDelete = () => {
    if (!deleting || (needsMoveTarget && !moveTo)) return
    remove.mutate({ category: deleting, moveTo }, { onSuccess: () => setDeleting(null) })
  }

  const renderBody = () => {
    if (categories.isPending) {
      return Array.from({ length: 4 }, (_, i) => (
        <Table.Tr key={i} data-testid="category-row-skeleton">
          {Array.from({ length: columns }, (_, j) => (
            <Table.Td key={j}>
              <Skeleton height={14} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))
    }
    return list.map((category, index) => (
      <Table.Tr key={category.id}>
        <Table.Td>
          <Text size="sm" fw={500}>
            {category.name}
          </Text>
        </Table.Td>
        {showProductCounts && (
          <>
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
          </>
        )}
        {!readOnly && (
          <Table.Td>
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <Tooltip label="Lên trên">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Đưa ${category.name} lên trên`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => reorder.mutate(moveItem(list, index, -1))}
                >
                  <IconArrowUp size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Xuống dưới">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Đưa ${category.name} xuống dưới`}
                  disabled={index === list.length - 1 || reorder.isPending}
                  onClick={() => reorder.mutate(moveItem(list, index, 1))}
                >
                  <IconArrowDown size={18} />
                </ActionIcon>
              </Tooltip>
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
                  onClick={() => openDelete(category)}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Table.Td>
        )}
      </Table.Tr>
    ))
  }

  const deleteMessage = !deleting ? null : needsMoveTarget ? (
    <Stack gap="sm">
      <Text size="sm">
        {formatNumber(deleting.product_count)} sản phẩm đang thuộc "{deleting.name}". Chọn danh mục
        để chuyển các sản phẩm này sang trước khi xóa.
      </Text>
      {moveTargets.length === 0 ? (
        <Text size="sm" c="red">
          Shop chưa có danh mục nào khác. Hãy thêm danh mục mới trước.
        </Text>
      ) : (
        <Select
          label="Chuyển sản phẩm sang"
          placeholder="Chọn danh mục"
          data={moveTargets}
          value={moveToId}
          onChange={setMoveToId}
          searchable
          withAsterisk
          comboboxProps={{ withinPortal: false }}
        />
      )}
    </Stack>
  ) : (
    `Danh mục "${deleting.name}" chưa có sản phẩm nào.`
  )

  return (
    <Paper withBorder radius="md" p="md">
      {!readOnly && (
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
      )}

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
          description="Tạo danh mục riêng của shop để phân loại sản phẩm. Sản phẩm cần có danh mục mới đăng bán được."
        />
      ) : (
        <Table.ScrollContainer minWidth={showProductCounts ? 480 : 280}>
          <Table verticalSpacing="sm" highlightOnHover aria-busy={categories.isFetching}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Danh mục</Table.Th>
                {showProductCounts && (
                  <>
                    <Table.Th scope="col" ta="right">
                      Số sản phẩm
                    </Table.Th>
                    <Table.Th scope="col" ta="right">
                      Đang bán
                    </Table.Th>
                  </>
                )}
                {!readOnly && (
                  <Table.Th scope="col">
                    <VisuallyHidden>Thao tác</VisuallyHidden>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{renderBody()}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Modal
        opened={editing !== null}
        onClose={update.isPending ? () => {} : () => setEditing(null)}
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
            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                onClick={() => setEditing(null)}
                disabled={update.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" loading={update.isPending}>
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
        confirmDisabled={needsMoveTarget && !moveTo}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </Paper>
  )
}
