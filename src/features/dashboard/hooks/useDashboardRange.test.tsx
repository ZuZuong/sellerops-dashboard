import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useDashboardRange } from './useDashboardRange'

function setup(initialPath: string) {
  let hookChildren: ReactNode = null
  function Outlet() {
    return <>{hookChildren}</>
  }
  // Router tạo một lần cho mỗi test; wrapper chỉ chuyển children của renderHook vào route.
  const router = createMemoryRouter([{ path: '/', Component: Outlet }], {
    initialEntries: [initialPath],
  })
  const wrapper = ({ children }: { children: ReactNode }) => {
    hookChildren = children
    return <RouterProvider router={router} />
  }
  const hook = renderHook(() => useDashboardRange(), { wrapper })
  return { ...hook, getSearch: () => router.state.location.search }
}

describe('useDashboardRange', () => {
  it('mặc định 30 ngày khi URL không có tham số', () => {
    const { result } = setup('/')
    expect(result.current.range).toBe('30d')
    expect(result.current.days).toBe(30)
  })

  it('đọc giá trị hợp lệ từ URL', () => {
    const { result } = setup('/?range=7d')
    expect(result.current.days).toBe(7)
  })

  it('bỏ qua giá trị không hợp lệ', () => {
    const { result } = setup('/?range=999d')
    expect(result.current.range).toBe('30d')
  })

  it('ghi lên URL, giữ tham số khác và xóa tham số khi về mặc định', () => {
    const { result, getSearch } = setup('/?foo=bar')

    act(() => result.current.setRange('7d'))
    expect(result.current.days).toBe(7)
    expect(getSearch()).toBe('?foo=bar&range=7d')

    act(() => result.current.setRange('30d'))
    expect(getSearch()).toBe('?foo=bar')
  })
})
