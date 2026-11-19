import { describe, expect, it } from 'vitest'
import { getRedirectPath } from './redirect'

describe('getRedirectPath', () => {
  it('quay lại trang trước đó, giữ cả query string', () => {
    expect(
      getRedirectPath({ from: { pathname: '/seller/orders', search: '?status=pending' } }),
    ).toBe('/seller/orders?status=pending')
  })

  it('bỏ qua search nếu không phải chuỗi', () => {
    expect(getRedirectPath({ from: { pathname: '/seller/products', search: 42 } })).toBe(
      '/seller/products',
    )
  })

  it.each([
    ['state rỗng', null],
    ['không có from', { other: true }],
    ['from không phải object', { from: '/seller/orders' }],
    ['thiếu pathname', { from: { search: '?a=1' } }],
    ['pathname không phải chuỗi', { from: { pathname: 1 } }],
  ])('về dashboard khi %s', (_label, state) => {
    expect(getRedirectPath(state)).toBe('/')
  })

  it('không quay vòng về /login', () => {
    expect(getRedirectPath({ from: { pathname: '/login', search: '' } })).toBe('/')
  })

  it.each(['https://evil.example', '//evil.example/path', 'orders'])(
    'chặn chuyển hướng ra ngoài app: %s',
    (pathname) => {
      expect(getRedirectPath({ from: { pathname, search: '' } })).toBe('/')
    },
  )
})
