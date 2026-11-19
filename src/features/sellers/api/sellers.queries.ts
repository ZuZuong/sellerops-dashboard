import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getSessionUserId, useCurrentUser } from '@/features/auth'
import { fetchOwnSeller, subscribeToOwnSeller } from './sellers.api'

export const sellerKeys = {
  all: ['sellers'] as const,
  own: (userId: string) => [...sellerKeys.all, 'own', userId] as const,
}

const ownSellerQuery = (userId: string) =>
  queryOptions({
    queryKey: sellerKeys.own(userId),
    queryFn: () => fetchOwnSeller(userId),
    // Thay đổi trạng thái shop đến qua Realtime (invalidate) → không cần tự làm mới thường xuyên.
    staleTime: 5 * 60_000,
  })

/**
 * Shop của seller đang đăng nhập: `seller_id` dùng cho mọi dữ liệu kinh doanh (thay cho user_id)
 * và `status` quyết định dashboard mở hay bị khóa.
 */
export function useCurrentSeller() {
  const user = useCurrentUser()
  const ownerId = user?.id
  const queryClient = useQueryClient()

  // Admin duyệt / từ chối / tạm khóa → dashboard mở hoặc khóa ngay, không cần tải lại trang.
  useEffect(() => {
    if (!ownerId) return
    return subscribeToOwnSeller(ownerId, () => {
      void queryClient.invalidateQueries({ queryKey: sellerKeys.own(ownerId) })
    })
  }, [ownerId, queryClient])

  return useQuery({ ...ownSellerQuery(ownerId ?? 'anonymous'), enabled: ownerId !== undefined })
}

/** Prefetch shop trong route loader — chạy song song với việc đọc tài khoản và tải code trang. */
export async function prefetchOwnSeller(queryClient: QueryClient): Promise<void> {
  const userId = await getSessionUserId()
  if (userId) await queryClient.prefetchQuery(ownSellerQuery(userId))
}
