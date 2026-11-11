import { useCallback } from 'react'
import { useUrlState, type SetUrlStateOptions } from '@/shared/hooks/useUrlState'
import {
  inventoryFiltersSchema,
  type InventoryFilters,
  type InventorySortField,
} from '../schemas/inventoryFilters.schema'

const FILTER_FIELDS = ['q', 'level', 'status'] as const

/** Filter / sort / phân trang trang Kho hàng trên URL; đổi filter / sort quay về trang 1. */
export function useInventoryFilters() {
  const { state: filters, setState, defaults } = useUrlState(inventoryFiltersSchema)

  const setFilters = useCallback(
    (patch: Partial<Omit<InventoryFilters, 'page'>>, options?: SetUrlStateOptions) => {
      setState({ ...patch, page: 1 }, options)
    },
    [setState],
  )

  const setPage = useCallback((page: number) => setState({ page }), [setState])

  const toggleSort = useCallback(
    (field: InventorySortField) => {
      // Cột mới: tồn kho thấp nhất / tên A→Z / giá vốn cao nhất trước.
      const firstOrder = field === 'cost_price' ? 'desc' : 'asc'
      const order = filters.sort === field ? (filters.order === 'asc' ? 'desc' : 'asc') : firstOrder
      setState({ sort: field, order, page: 1 })
    },
    [filters.order, filters.sort, setState],
  )

  const resetFilters = useCallback(() => {
    const { q, level, status } = defaults
    setState({ q, level, status, page: 1 })
  }, [defaults, setState])

  const hasActiveFilters = FILTER_FIELDS.some((key) => filters[key] !== defaults[key])

  return { filters, setFilters, setPage, toggleSort, resetFilters, hasActiveFilters }
}
