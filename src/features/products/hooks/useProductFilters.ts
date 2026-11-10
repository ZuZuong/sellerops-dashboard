import { useCallback } from 'react'
import { useUrlState, type SetUrlStateOptions } from '@/shared/hooks/useUrlState'
import {
  DEFAULT_SORT_ORDER,
  productFiltersSchema,
  type ProductFilters,
  type ProductSortField,
} from '../schemas/productFilters.schema'

/** Các trường làm thay đổi tập kết quả (khác với sort / phân trang). */
const FILTER_FIELDS = ['q', 'category', 'status', 'stock'] as const

/**
 * Filter / sort / phân trang sản phẩm trên URL.
 * Đổi filter, sort hoặc kích thước trang luôn quay về trang 1 để không rơi vào trang rỗng.
 */
export function useProductFilters() {
  const { state: filters, setState, defaults } = useUrlState(productFiltersSchema)

  const setFilters = useCallback(
    (patch: Partial<Omit<ProductFilters, 'page'>>, options?: SetUrlStateOptions) => {
      setState({ ...patch, page: 1 }, options)
    },
    [setState],
  )

  const setPage = useCallback((page: number) => setState({ page }), [setState])

  const toggleSort = useCallback(
    (field: ProductSortField) => {
      const order =
        filters.sort === field
          ? filters.order === 'asc'
            ? 'desc'
            : 'asc'
          : DEFAULT_SORT_ORDER[field]
      setState({ sort: field, order, page: 1 })
    },
    [filters.order, filters.sort, setState],
  )

  // Giữ nguyên sort và kích thước trang; chỉ xóa điều kiện lọc.
  const resetFilters = useCallback(() => {
    const { q, category, status, stock } = defaults
    setState({ q, category, status, stock, page: 1 })
  }, [defaults, setState])

  const hasActiveFilters = FILTER_FIELDS.some((key) => filters[key] !== defaults[key])

  return { filters, setFilters, setPage, toggleSort, resetFilters, hasActiveFilters }
}
