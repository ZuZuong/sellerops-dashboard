import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useProductFilters } from './useProductFilters'

function setup(initialPath: string) {
  let hookChildren: ReactNode = null
  function Route() {
    return <>{hookChildren}</>
  }
  const router = createMemoryRouter([{ path: '/products', Component: Route }], {
    initialEntries: [initialPath],
  })
  const wrapper = ({ children }: { children: ReactNode }) => {
    hookChildren = children
    return <RouterProvider router={router} />
  }
  const hook = renderHook(() => useProductFilters(), { wrapper })
  return { ...hook, search: () => router.state.location.search }
}

describe('useProductFilters', () => {
  it('đổi filter thì quay về trang 1', () => {
    const { result, search } = setup('/products?page=4')
    expect(result.current.filters.page).toBe(4)

    act(() => result.current.setFilters({ status: 'active' }))
    expect(result.current.filters).toMatchObject({ status: 'active', page: 1 })
    expect(search()).toBe('?status=active')
  })

  it('đổi kích thước trang cũng quay về trang 1', () => {
    const { result } = setup('/products?page=3')
    act(() => result.current.setFilters({ pageSize: 20 }))
    expect(result.current.filters).toMatchObject({ pageSize: 20, page: 1 })
  })

  it('setPage chỉ đổi trang, giữ filter', () => {
    const { result } = setup('/products?q=ao')
    act(() => result.current.setPage(2))
    expect(result.current.filters).toMatchObject({ q: 'ao', page: 2 })
  })

  it('toggleSort: cột mới dùng chiều mặc định, bấm lại thì đảo chiều', () => {
    const { result } = setup('/products?page=2')

    act(() => result.current.toggleSort('name'))
    expect(result.current.filters).toMatchObject({ sort: 'name', order: 'asc', page: 1 })

    act(() => result.current.toggleSort('name'))
    expect(result.current.filters).toMatchObject({ sort: 'name', order: 'desc' })

    act(() => result.current.toggleSort('price'))
    expect(result.current.filters).toMatchObject({ sort: 'price', order: 'desc' })
  })

  it('hasActiveFilters chỉ tính điều kiện lọc, không tính sort / trang', () => {
    const { result } = setup('/products?sort=name&order=asc&page=2')
    expect(result.current.hasActiveFilters).toBe(false)

    act(() => result.current.setFilters({ stock: 'low' }))
    expect(result.current.hasActiveFilters).toBe(true)
  })

  it('resetFilters xóa điều kiện lọc nhưng giữ sort và kích thước trang', () => {
    const { result, search } = setup(
      '/products?q=ao&category=%C3%81o&status=inactive&stock=out&sort=price&order=asc&pageSize=20&page=3',
    )
    act(() => result.current.resetFilters())
    expect(result.current.filters).toEqual({
      q: '',
      category: '',
      status: 'all',
      stock: 'all',
      sort: 'price',
      order: 'asc',
      page: 1,
      pageSize: 20,
    })
    expect(search()).toBe('?sort=price&order=asc&pageSize=20')
  })
})
