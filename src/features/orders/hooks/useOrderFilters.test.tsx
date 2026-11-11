import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useOrderFilters } from './useOrderFilters'

const setup = (url: string) =>
  renderHook(() => useOrderFilters(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    ),
  })

describe('useOrderFilters', () => {
  it('đọc filter từ URL; giá trị sai rơi về mặc định', () => {
    const { result } = setup('/orders?status=shipping&q=DH-0001&page=3&pageSize=7')
    expect(result.current.filters).toEqual({
      q: 'DH-0001',
      status: 'shipping',
      sort: 'created_at',
      order: 'desc',
      page: 3,
      pageSize: 10,
    })
    expect(result.current.hasActiveFilters).toBe(true)

    const invalid = setup('/orders?status=lost')
    expect(invalid.result.current.filters.status).toBe('all')
    expect(invalid.result.current.hasActiveFilters).toBe(false)
  })

  it('đổi trạng thái lọc quay về trang 1', () => {
    const { result } = setup('/orders?page=4')
    act(() => result.current.setFilters({ status: 'pending' }))
    expect(result.current.filters).toMatchObject({ status: 'pending', page: 1 })
  })

  it('sắp xếp: cột mới giảm dần, bấm lại đảo chiều', () => {
    const { result } = setup('/orders')
    act(() => result.current.toggleSort('total'))
    expect(result.current.filters).toMatchObject({ sort: 'total', order: 'desc' })
    act(() => result.current.toggleSort('total'))
    expect(result.current.filters).toMatchObject({ sort: 'total', order: 'asc' })
  })

  it('xóa bộ lọc giữ nguyên sắp xếp', () => {
    const { result } = setup('/orders?q=lan&status=cancelled&sort=total')
    act(() => result.current.resetFilters())
    expect(result.current.filters).toMatchObject({ q: '', status: 'all', sort: 'total' })
    expect(result.current.hasActiveFilters).toBe(false)
  })
})
