import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard'
import { useSellerScope } from '@/shared/hooks/useSellerScope'
import type { ReportRange } from '../types'
import {
  fetchRevenueByCategory,
  fetchRevenueByDay,
  fetchRevenueReport,
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
  summary: (sellerId: string, range: ReportRange) =>
    [...analyticsKeys.all, sellerId, 'summary', range] as const,
  revenueByDay: (sellerId: string, range: ReportRange) =>
    [...analyticsKeys.all, sellerId, 'revenue-by-day', range] as const,
  revenueByCategory: (sellerId: string, range: ReportRange) =>
    [...analyticsKeys.all, sellerId, 'revenue-by-category', range] as const,
  revenueReport: (sellerId: string, range: ReportRange) =>
    [...analyticsKeys.all, sellerId, 'revenue-report', range] as const,
  stockLedger: (sellerId: string, range: ReportRange) =>
    [...analyticsKeys.all, sellerId, 'stock-ledger', range] as const,
  topProducts: (sellerId: string, range: ReportRange, limit: number) =>
    [...analyticsKeys.all, sellerId, 'top-products', range, limit] as const,
}

// Báo cáo không cần tươi từng giây; giữ dữ liệu cũ khi đổi khoảng để widget không nháy skeleton.
const options = { staleTime: 60_000, placeholderData: keepPreviousData }

export function useSalesSummary(range: ReportRange) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: analyticsKeys.summary(sellerId, range),
    queryFn: () => fetchSalesSummary(sellerId, range),
    ...options,
  })
}

export function useRevenueByDay(range: ReportRange) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: analyticsKeys.revenueByDay(sellerId, range),
    queryFn: () => fetchRevenueByDay(sellerId, range),
    ...options,
  })
}

export function useRevenueByCategory(range: ReportRange) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: analyticsKeys.revenueByCategory(sellerId, range),
    queryFn: () => fetchRevenueByCategory(sellerId, range),
    ...options,
  })
}

export function useTopProductsByRange(range: ReportRange, limit = 10) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: analyticsKeys.topProducts(sellerId, range, limit),
    queryFn: () => fetchTopProductsByRange(sellerId, range, limit),
    ...options,
  })
}

export function useStockLedger(range: ReportRange) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: analyticsKeys.stockLedger(sellerId, range),
    queryFn: () => fetchStockLedger(sellerId, range),
    ...options,
  })
}

/** Bảng kê doanh thu để in / nộp: không giữ dữ liệu khoảng cũ (tránh in nhầm kỳ). */
export function useRevenueReport(range: ReportRange) {
  const { sellerId } = useSellerScope()
  return useQuery({
    queryKey: analyticsKeys.revenueReport(sellerId, range),
    queryFn: () => fetchRevenueReport(sellerId, range),
    staleTime: 0,
  })
}
