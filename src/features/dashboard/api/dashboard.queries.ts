import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { QUERY_ROOTS } from '@/shared/constants/queryRoots'
import { useSellerScope } from '@/shared/hooks/useSellerScope'
import {
  fetchDashboardKpis,
  fetchRecentOrders,
  fetchRevenueSeries,
  fetchTopProducts,
} from './dashboard.api'

/**
 * Query key factory của dashboard. Mutation ở feature khác (xác nhận / hủy đơn, sửa kho)
 * invalidate `dashboardKeys.all` để mọi widget làm mới cùng lúc. Key lá chứa `sellerId`.
 */
export const dashboardKeys = {
  all: [QUERY_ROOTS.dashboard] as const,
  seller: (sellerId: string) => [...dashboardKeys.all, sellerId] as const,
  kpis: (sellerId: string, days: number) =>
    [...dashboardKeys.seller(sellerId), 'kpis', days] as const,
  revenueSeries: (sellerId: string, days: number) =>
    [...dashboardKeys.seller(sellerId), 'revenue-series', days] as const,
  topProducts: (sellerId: string, days: number, limit: number) =>
    [...dashboardKeys.seller(sellerId), 'top-products', days, limit] as const,
  recentOrders: (sellerId: string, limit: number) =>
    [...dashboardKeys.seller(sellerId), 'recent-orders', limit] as const,
}

// Số liệu tổng hợp không cần tươi từng giây; giữ dữ liệu cũ khi đổi khoảng thời gian
// để widget không nhấp nháy về skeleton.
const STALE_TIME = 60_000

export function useDashboardKpis(days: number) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: dashboardKeys.kpis(sellerId, days),
    queryFn: () => fetchDashboardKpis(sellerId, days),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

export function useRevenueSeries(days: number) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: dashboardKeys.revenueSeries(sellerId, days),
    queryFn: () => fetchRevenueSeries(sellerId, days),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

export function useTopProducts(days: number, limit = 5) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: dashboardKeys.topProducts(sellerId, days, limit),
    queryFn: () => fetchTopProducts(sellerId, days, limit),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

export function useRecentOrders(limit = 5) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: dashboardKeys.recentOrders(sellerId, limit),
    queryFn: () => fetchRecentOrders(sellerId, limit),
    staleTime: STALE_TIME,
  })
}
