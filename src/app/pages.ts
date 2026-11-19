import type { ComponentType } from 'react'

type PageModule = Promise<{ default: ComponentType }>
type PageImport = () => PageModule

/** Mỗi trang là một chunk riêng (lazy-load theo route). */
export const sellerPages = {
  dashboard: () => import('@/pages/DashboardPage'),
  products: () => import('@/pages/ProductsPage'),
  productImports: () => import('@/pages/ProductImportsPage'),
  productTrash: () => import('@/pages/ProductTrashPage'),
  categories: () => import('@/pages/CategoriesPage'),
  orders: () => import('@/pages/OrdersPage'),
  orderDetail: () => import('@/pages/OrderDetailPage'),
  purchases: () => import('@/pages/PurchasesPage'),
  purchaseNew: () => import('@/pages/PurchaseNewPage'),
  purchaseDetail: () => import('@/pages/PurchaseDetailPage'),
  inventory: () => import('@/pages/InventoryPage'),
  inventoryStocktake: () => import('@/pages/InventoryStocktakePage'),
  analytics: () => import('@/pages/AnalyticsPage'),
  analyticsRevenueReport: () => import('@/pages/RevenueReportPage'),
} satisfies Record<string, PageImport>

export const adminPages = {
  dashboard: () => import('@/pages/AdminDashboardPage'),
  accounts: () => import('@/pages/AdminAccountsPage'),
  approvals: () => import('@/pages/AdminApprovalsPage'),
  sellers: () => import('@/pages/AdminSellersPage'),
  sellerDetail: () => import('@/pages/AdminSellerDetailPage'),
  deletions: () => import('@/pages/AdminDeletionsPage'),
  auditLog: () => import('@/pages/AdminAuditLogPage'),
} satisfies Record<string, PageImport>

/** Route `lazy` cho một page (default export). */
export const page = (load: PageImport) => async () => ({ Component: (await load()).default })

const preloaded = new WeakSet<object>()

/**
 * Tải trước code các trang khi trình duyệt rảnh (sau khi trang hiện tại đã hiển thị): bấm sang
 * trang khác không phải chờ tải chunk. Mỗi nhóm chỉ tải trước một lần; lỗi mạng bỏ qua (khi bấm
 * vào trang, route sẽ tải lại bình thường).
 */
export function preloadWhenIdle(pages: Record<string, PageImport>): void {
  if (preloaded.has(pages) || typeof window === 'undefined') return
  preloaded.add(pages)
  const run = () => {
    for (const load of Object.values(pages)) void load().catch(() => undefined)
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 5000 })
  else setTimeout(run, 2000)
}
