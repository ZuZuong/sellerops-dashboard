import { useCallback } from 'react'
import { useUrlState, type SetUrlStateOptions } from '@/shared/hooks/useUrlState'
import { receiptFiltersSchema, type ReceiptFilters } from '../schemas/receiptFilters.schema'

/** Filter / phân trang phiếu nhập trên URL; đổi filter quay về trang 1. */
export function useReceiptFilters() {
  const { state: filters, setState, defaults } = useUrlState(receiptFiltersSchema)

  const setFilters = useCallback(
    (patch: Partial<Omit<ReceiptFilters, 'page'>>, options?: SetUrlStateOptions) =>
      setState({ ...patch, page: 1 }, options),
    [setState],
  )
  const setPage = useCallback((page: number) => setState({ page }), [setState])
  const resetFilters = useCallback(
    () => setState({ q: defaults.q, status: defaults.status, page: 1 }),
    [defaults, setState],
  )
  const hasActiveFilters = filters.q !== defaults.q || filters.status !== defaults.status

  return { filters, setFilters, setPage, resetFilters, hasActiveFilters }
}
