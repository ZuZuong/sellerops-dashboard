/** Khóa (trong sessionStorage của tab) ghi tên khóa phiên mà lần tải trang trước đang dùng. */
export const AUTH_KEY_POINTER = 'sellerops-auth-key'
const AUTH_KEY_PREFIX = 'sellerops-auth-'

type SyncStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/**
 * Chọn khóa lưu phiên đăng nhập cho LẦN TẢI TRANG này, mỗi lần một khóa mới.
 *
 * Vì sao không dùng khóa cố định theo tab: trình duyệt SAO CHÉP sessionStorage khi nhân đôi tab hoặc
 * mở link sang tab mới. Hai tab mang cùng khóa thì Supabase đồng bộ đăng nhập / đăng xuất giữa
 * chúng (BroadcastChannel đặt tên theo khóa) → admin bị đăng xuất theo khi tab seller bị đá ra.
 *
 * Khóa mới mỗi lần tải: phiên của lần trước (kể cả bản sao từ tab gốc) được CHUYỂN sang khóa mới
 * → tải lại trang vẫn đăng nhập, tab nhân đôi giữ phiên nhưng từ đó độc lập hoàn toàn.
 */
export function rotateAuthStorageKey(storage: SyncStorage, loadId: string): string {
  const nextKey = `${AUTH_KEY_PREFIX}${loadId}`
  const previousKey = storage.getItem(AUTH_KEY_POINTER)

  if (previousKey && previousKey !== nextKey && previousKey.startsWith(AUTH_KEY_PREFIX)) {
    // Supabase lưu nhiều mục cùng tiền tố (phiên, code verifier PKCE, user…).
    const keys: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(previousKey)) keys.push(key)
    }
    for (const key of keys) {
      const value = storage.getItem(key)
      if (value !== null) storage.setItem(nextKey + key.slice(previousKey.length), value)
      storage.removeItem(key)
    }
  }

  storage.setItem(AUTH_KEY_POINTER, nextKey)
  return nextKey
}
