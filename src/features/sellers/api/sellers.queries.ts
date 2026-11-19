import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useCurrentUser } from '@/features/auth'
import { fetchOwnSeller, subscribeToOwnSeller } from './sellers.api'

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
  const queryClient = useQueryClient()

  // Admin duyệt / từ chối / tạm khóa → dashboard mở hoặc khóa ngay, không cần tải lại trang.
  const ownerId = user?.id
  useEffect(() => {
    if (!ownerId) return
    return subscribeToOwnSeller(ownerId, () => {
      void queryClient.invalidateQueries({ queryKey: sellerKeys.own(ownerId) })
    })
  }, [ownerId, queryClient])

  return useQuery({
    queryKey: sellerKeys.own(userId),
    queryFn: () => fetchOwnSeller(userId),
    enabled: user !== null,
  })
}
