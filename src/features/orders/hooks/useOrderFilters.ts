import { useCallback } from 'react'
import { useUrlState, type SetUrlStateOptions } from '@/shared/hooks/useUrlState'
import {
  orderFiltersSchema,
  type OrderFilters,
  type OrderSortField,
} from '../schemas/orderFilters.schema'

/** Các trường làm thay đổi tập kết quả (khác với sort / phân trang). */
const FILTER_FIELDS = ['q', 'status'] as const

/**
 * Filter / sort / phân trang đơn hàng trên URL (chia sẻ link, Back/Forward giữ nguyên bộ lọc).
 * Đổi filter, sort hoặc kích thước trang luôn quay về trang 1.
 */
export function useOrderFilters() {
  const { state: filters, setState, defaults } = useUrlState(orderFiltersSchema)

  const setFilters = useCallback(
    (patch: Partial<Omit<OrderFilters, 'page'>>, options?: SetUrlStateOptions) => {
      setState({ ...patch, page: 1 }, options)
    },
    [setState],
  )

  const setPage = useCallback((page: number) => setState({ page }), [setState])

  const toggleSort = useCallback(
    (field: OrderSortField) => {
      // Cột mới: mới nhất / giá trị lớn nhất trước.
      const order = filters.sort === field && filters.order === 'desc' ? 'asc' : 'desc'
      setState({ sort: field, order, page: 1 })
    },
    [filters.order, filters.sort, setState],
  )

  const resetFilters = useCallback(() => {
    const { q, status } = defaults
    setState({ q, status, page: 1 })
  }, [defaults, setState])

  const hasActiveFilters = FILTER_FIELDS.some((key) => filters[key] !== defaults[key])

  return { filters, setFilters, setPage, toggleSort, resetFilters, hasActiveFilters }
}
