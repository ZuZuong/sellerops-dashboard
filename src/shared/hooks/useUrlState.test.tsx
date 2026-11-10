import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { useUrlState } from './useUrlState'

const schema = z.object({
  q: z.string().catch(''),
  sort: z.enum(['name', 'price']).catch('name'),
  page: z.coerce.number().int().min(1).catch(1),
})

function setup(initialPath: string) {
  let hookChildren: ReactNode = null
  function Route() {
    return <>{hookChildren}</>
  }
  const router = createMemoryRouter([{ path: '/', Component: Route }], {
    initialEntries: [initialPath],
  })
  const wrapper = ({ children }: { children: ReactNode }) => {
    hookChildren = children
    return <RouterProvider router={router} />
  }
  const hook = renderHook(() => useUrlState(schema), { wrapper })
  return { ...hook, router, search: () => router.state.location.search }
}

describe('useUrlState', () => {
  it('đọc state từ URL, trường thiếu / sai dùng mặc định', () => {
    const { result } = setup('/?q=ao&sort=bogus&page=2')
    expect(result.current.state).toEqual({ q: 'ao', sort: 'name', page: 2 })
    expect(result.current.defaults).toEqual({ q: '', sort: 'name', page: 1 })
  })

  it('ghi patch lên URL, bỏ giá trị mặc định, giữ tham số ngoài schema', () => {
    const { result, search } = setup('/?other=1&page=3')

    act(() => result.current.setState({ q: 'quần', sort: 'price' }))
    expect(result.current.state).toEqual({ q: 'quần', sort: 'price', page: 3 })
    expect(new URLSearchParams(search()).get('q')).toBe('quần')
    expect(search()).toContain('other=1')

    act(() => result.current.setState({ sort: 'name', page: 1 }))
    expect(search()).not.toContain('sort=')
    expect(search()).not.toContain('page=')
  })

  it('replace không thêm entry vào history, mặc định thì có', () => {
    const { result, router } = setup('/')

    act(() => result.current.setState({ page: 2 }))
    act(() => result.current.setState({ q: 'a' }, { replace: true }))

    act(() => void router.navigate(-1))
    expect(router.state.location.search).toBe('')
  })

  it('reset về mặc định', () => {
    const { result, search } = setup('/?q=a&page=4&other=x')
    act(() => result.current.reset())
    expect(result.current.state).toEqual({ q: '', sort: 'name', page: 1 })
    expect(search()).toBe('?other=x')
  })
})
