import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth'
import { fetchOwnSeller } from './sellers.api'

export const sellerKeys = {
  all: ['sellers'] as const,
  own: (userId: string) => [...sellerKeys.all, 'own', userId] as const,
}

/**
 * Shop của seller đang đăng nhập: `seller_id` dùng cho mọi dữ liệu kinh doanh (thay cho user_id)
 * và `status` quyết định dashboard mở hay bị khóa.
 */
export function useCurrentSeller() {
  const user = useCurrentUser()
  const userId = user?.id ?? 'anonymous'
  return useQuery({
    queryKey: sellerKeys.own(userId),
    queryFn: () => fetchOwnSeller(userId),
    enabled: user !== null,
  })
}
