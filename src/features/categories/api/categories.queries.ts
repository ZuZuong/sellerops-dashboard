import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { QUERY_ROOTS } from '@/shared/constants/queryRoots'
import { useSellerScope } from '@/shared/hooks/useSellerScope'
import { change, withChanges } from '@/shared/lib/activityChanges'
import { formatNumber } from '@/shared/lib/formatters'
import { getCategoryErrorMessage } from '../lib/categoryErrors'
import type { CategoryOption, CategoryOverview } from '../types'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  reorderCategories,
  updateCategory,
} from './categories.api'

export const categoryKeys = {
  all: [QUERY_ROOTS.categories] as const,
  list: (sellerId: string) => [...categoryKeys.all, sellerId] as const,
}

const categoriesQuery = (sellerId: string) => ({
  queryKey: categoryKeys.list(sellerId),
  queryFn: () => fetchCategories(sellerId),
})

const toOptions = (rows: readonly CategoryOverview[]): CategoryOption[] =>
  rows.map((row) => ({ value: row.id, label: row.name }))

/** Danh mục của shop đang xem, kèm số sản phẩm. */
export function useCategories() {
  const { sellerId } = useSellerScope()
  return useQuery(categoriesQuery(sellerId))
}

/** Lựa chọn cho ô Select (form sản phẩm, bộ lọc). */
export function useCategoryOptions() {
  const { sellerId } = useSellerScope()
  return useQuery({ ...categoriesQuery(sellerId), select: toOptions })
}

/** Lấy tên danh mục khi cần ngay (đọc file Excel, tạo file mẫu): dùng cache nếu đã có. */
export function useLoadCategoryNames() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  return () =>
    queryClient
      .ensureQueryData(categoriesQuery(sellerId))
      .then((rows) => rows.filter((row) => row.is_active).map((row) => row.name))
}

/** Danh mục đổi → sản phẩm (hiển thị tên danh mục) và báo cáo theo danh mục cũng phải làm mới. */
function invalidateAfterCategoryChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.products] }),
    queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.dashboard] }),
  ])
}

function notifyError(title: string, error: unknown) {
  notifications.show({ color: 'red', title, message: getCategoryErrorMessage(error) })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: (_id, name) => {
      notifications.show({
        color: 'green',
        title: 'Đã thêm danh mục',
        message: name,
        ...withChanges([change('Danh mục', null, name)]),
      })
      return invalidateAfterCategoryChange(queryClient)
    },
    onError: (error) => notifyError('Không thêm được danh mục', error),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ category, name }: { category: CategoryOverview; name: string }) =>
      updateCategory(category.id, name, category.is_active),
    onSuccess: (_data, { category, name }) => {
      notifications.show({
        color: 'green',
        title: 'Đã đổi tên danh mục',
        message: `"${category.name}" → "${name}"`,
        ...withChanges([change('Tên danh mục', category.name, name)]),
      })
      return invalidateAfterCategoryChange(queryClient)
    },
    onError: (error) => notifyError('Không đổi tên được danh mục', error),
  })
}

/**
 * Đổi thứ tự có optimistic update: danh sách đổi chỗ ngay, lỗi thì trả về thứ tự cũ.
 */
export function useReorderCategories() {
  const { sellerId } = useSellerScope()
  const queryClient = useQueryClient()
  const key = categoryKeys.list(sellerId)
  return useMutation({
    mutationFn: (ordered: readonly CategoryOverview[]) =>
      reorderCategories(ordered.map((c) => c.id)),
    onMutate: async (ordered) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<CategoryOverview[]>(key)
      queryClient.setQueryData<CategoryOverview[]>(key, [...ordered])
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      notifyError('Không đổi được thứ tự danh mục', error)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      category,
      moveTo,
    }: {
      category: CategoryOverview
      moveTo: CategoryOption | null
    }) => deleteCategory(category.id, moveTo?.value ?? null),
    onSuccess: ({ moved }, { category, moveTo }) => {
      notifications.show({
        color: 'green',
        title: `Đã xóa danh mục "${category.name}"`,
        message:
          moved > 0 && moveTo
            ? `${formatNumber(moved)} sản phẩm đã chuyển sang "${moveTo.label}".`
            : 'Không có sản phẩm nào thuộc danh mục này.',
        ...withChanges([change('Danh mục', category.name, null)]),
      })
      return invalidateAfterCategoryChange(queryClient)
    },
    onError: (error) => notifyError('Không xóa được danh mục', error),
  })
}
