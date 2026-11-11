import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import type { ReportRange } from '../types'
import {
  fetchRevenueByCategory,
  fetchRevenueByDay,
  fetchSalesSummary,
  fetchStockLedger,
  fetchTopProductsByRange,
} from './analytics.api'

/**
 * Báo cáo cùng họ số liệu với dashboard → key nằm dưới `dashboardKeys.all`: mọi mutation đã
 * invalidate dashboard (xác nhận / hủy đơn, điều chỉnh kho) tự làm mới trang Phân tích.
 */
export const analyticsKeys = {
  all: [...dashboardKeys.all, 'analytics'] as const,
  summary: (range: ReportRange) => [...analyticsKeys.all, 'summary', range] as const,
  revenueByDay: (range: ReportRange) => [...analyticsKeys.all, 'revenue-by-day', range] as const,
  revenueByCategory: (range: ReportRange) =>
    [...analyticsKeys.all, 'revenue-by-category', range] as const,
  stockLedger: (range: ReportRange) => [...analyticsKeys.all, 'stock-ledger', range] as const,
  topProducts: (range: ReportRange, limit: number) =>
    [...analyticsKeys.all, 'top-products', range, limit] as const,
}

// Báo cáo không cần tươi từng giây; giữ dữ liệu cũ khi đổi khoảng để widget không nháy skeleton.
const options = { staleTime: 60_000, placeholderData: keepPreviousData }

export function useSalesSummary(range: ReportRange) {
  return useQuery({
    queryKey: analyticsKeys.summary(range),
    queryFn: () => fetchSalesSummary(range),
    ...options,
  })
}

export function useRevenueByDay(range: ReportRange) {
  return useQuery({
    queryKey: analyticsKeys.revenueByDay(range),
    queryFn: () => fetchRevenueByDay(range),
    ...options,
  })
}

export function useRevenueByCategory(range: ReportRange) {
  return useQuery({
    queryKey: analyticsKeys.revenueByCategory(range),
    queryFn: () => fetchRevenueByCategory(range),
    ...options,
  })
}

export function useTopProductsByRange(range: ReportRange, limit = 10) {
  return useQuery({
    queryKey: analyticsKeys.topProducts(range, limit),
    queryFn: () => fetchTopProductsByRange(range, limit),
    ...options,
  })
}

export function useStockLedger(range: ReportRange) {
  return useQuery({
    queryKey: analyticsKeys.stockLedger(range),
    queryFn: () => fetchStockLedger(range),
    ...options,
  })
}
