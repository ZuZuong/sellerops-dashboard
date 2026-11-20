import { beforeEach, describe, expect, it } from 'vitest'
import { AUTH_KEY_POINTER, rotateAuthStorageKey } from '@/shared/lib/authStorage'

/** sessionStorage giả lập cho một tab (mỗi tab một bản riêng). */
function createStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    snapshot: () => Object.fromEntries(map),
  }
}

describe('rotateAuthStorageKey', () => {
  let tab: ReturnType<typeof createStorage>

  beforeEach(() => {
    tab = createStorage()
  })

  it('lần đầu mở tab: tạo khóa mới, ghi con trỏ', () => {
    expect(rotateAuthStorageKey(tab, 'load-1')).toBe('sellerops-auth-load-1')
    expect(tab.getItem(AUTH_KEY_POINTER)).toBe('sellerops-auth-load-1')
  })

  it('tải lại trang: phiên (và các mục phụ cùng tiền tố) chuyển sang khóa mới → vẫn đăng nhập', () => {
    rotateAuthStorageKey(tab, 'load-1')
    tab.setItem('sellerops-auth-load-1', '{"access_token":"a"}')
    tab.setItem('sellerops-auth-load-1-code-verifier', 'v')
    tab.setItem('other-app-data', 'giu-nguyen')

    const key = rotateAuthStorageKey(tab, 'load-2')

    expect(key).toBe('sellerops-auth-load-2')
    expect(tab.snapshot()).toEqual({
      [AUTH_KEY_POINTER]: 'sellerops-auth-load-2',
      'sellerops-auth-load-2': '{"access_token":"a"}',
      'sellerops-auth-load-2-code-verifier': 'v',
      'other-app-data': 'giu-nguyen',
    })
  })

  it('tab nhân đôi (sessionStorage bị sao chép): mỗi tab ra khóa riêng, không bao giờ trùng', () => {
    rotateAuthStorageKey(tab, 'goc')
    tab.setItem('sellerops-auth-goc', '{"user":"admin"}')

    // Trình duyệt sao chép nguyên sessionStorage sang tab mới.
    const copy = createStorage(tab.snapshot())
    const copyKey = rotateAuthStorageKey(copy, 'ban-sao')

    expect(copyKey).not.toBe(tab.getItem(AUTH_KEY_POINTER))
    // Tab sao chép giữ phiên (vẫn đăng nhập) nhưng dưới khóa của riêng nó…
    expect(copy.getItem('sellerops-auth-ban-sao')).toBe('{"user":"admin"}')
    // …và tab gốc không bị ảnh hưởng.
    expect(tab.getItem('sellerops-auth-goc')).toBe('{"user":"admin"}')
  })

  it('con trỏ hỏng / lạ không làm mất dữ liệu khác', () => {
    tab.setItem(AUTH_KEY_POINTER, 'sb-khac')
    tab.setItem('sb-khac', 'x')
    rotateAuthStorageKey(tab, 'load-1')
    expect(tab.getItem('sb-khac')).toBe('x')
  })
})
