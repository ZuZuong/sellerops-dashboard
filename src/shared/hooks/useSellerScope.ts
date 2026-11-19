import { createContext, useContext } from 'react'

/**
 * Shop đang được xem trong dashboard.
 *  - Route seller: `sellerId` = shop của người đăng nhập, `readOnly = false`.
 *  - Route admin (Phase 3): `sellerId` lấy từ URL, `readOnly = true` (không impersonation).
 *
 * Mọi query dữ liệu shop đọc `sellerId` từ đây: đưa vào query key (cache không lẫn giữa các shop)
 * và lọc tường minh / truyền `p_seller_id` (admin đọc được mọi shop nên không thể chỉ dựa vào RLS).
 */
export interface SellerScope {
  sellerId: string
  readOnly: boolean
}

export const SellerScopeContext = createContext<SellerScope | null>(null)

export function useSellerScope(): SellerScope {
  const scope = useContext(SellerScopeContext)
  if (!scope) {
    throw new Error('useSellerScope phải được dùng bên trong <SellerScopeProvider>')
  }
  return scope
}
