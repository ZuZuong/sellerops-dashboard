import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchDashboardKpis,
  fetchRecentOrders,
  fetchRevenueSeries,
  fetchTopProducts,
} from './dashboard.api'

/**
 * Query key factory của dashboard. Mutation ở feature khác (xác nhận / hủy đơn, sửa kho)
 * invalidate `dashboardKeys.all` để mọi widget làm mới cùng lúc.
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: (days: number) => [...dashboardKeys.all, 'kpis', days] as const,
  revenueSeries: (days: number) => [...dashboardKeys.all, 'revenue-series', days] as const,
  topProducts: (days: number, limit: number) =>
    [...dashboardKeys.all, 'top-products', days, limit] as const,
  recentOrders: (limit: number) => [...dashboardKeys.all, 'recent-orders', limit] as const,
}

// Số liệu tổng hợp không cần tươi từng giây; giữ dữ liệu cũ khi đổi khoảng thời gian
// để widget không nhấp nháy về skeleton.
const STALE_TIME = 60_000

export function useDashboardKpis(days: number) {
  return useQuery({
    queryKey: dashboardKeys.kpis(days),
    queryFn: () => fetchDashboardKpis(days),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

export function useRevenueSeries(days: number) {
  return useQuery({
    queryKey: dashboardKeys.revenueSeries(days),
    queryFn: () => fetchRevenueSeries(days),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

export function useTopProducts(days: number, limit = 5) {
  return useQuery({
    queryKey: dashboardKeys.topProducts(days, limit),
    queryFn: () => fetchTopProducts(days, limit),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  })
}

export function useRecentOrders(limit = 5) {
  return useQuery({
    queryKey: dashboardKeys.recentOrders(limit),
    queryFn: () => fetchRecentOrders(limit),
    staleTime: STALE_TIME,
  })
}
