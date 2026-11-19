import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { AccountGate, GuestRoute, HomeRedirect, ProtectedRoute, RoleGuard } from '@/features/auth'
import { AdminLayout } from '@/layouts/AdminLayout'
import { SellerLayout } from '@/layouts/SellerLayout'
import { PageLoader } from '@/shared/components/PageLoader'
import { ROUTES } from '@/shared/constants/routes'
import { RouteErrorBoundary } from './RouteErrorBoundary'

/** Lazy-load một page (default export) theo route để code-split. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

const common = { ErrorBoundary: RouteErrorBoundary, HydrateFallback: PageLoader }

/**
 * Cây route:
 *   khách (GuestRoute)        /login /register /verify-email /forgot-password
 *   công khai                 /reset-password (phiên khôi phục từ link trong thư)
 *   đã đăng nhập (Protected → AccountGate: đọc role từ profiles, chặn tài khoản khóa)
 *     /                       chuyển hướng theo role
 *     /no-access              tài khoản người mua
 *     /seller/*  (seller)     SellerLayout: SellerScope + khóa theo trạng thái shop
 *     /admin/*   (admin)      AdminLayout: Admin Console (xem shop ở chế độ chỉ đọc)
 */
export const router = createBrowserRouter([
  {
    Component: ProtectedRoute,
    ...common,
    children: [
      {
        Component: AccountGate,
        children: [
          { path: ROUTES.home, Component: HomeRedirect },
          { path: ROUTES.noAccess, lazy: page(() => import('@/pages/NoAccessPage')) },
          {
            element: <RoleGuard allow={['seller']} />,
            children: [
              {
                path: ROUTES.dashboard,
                Component: SellerLayout,
                children: [
                  { index: true, lazy: page(() => import('@/pages/DashboardPage')) },
                  { path: ROUTES.products, lazy: page(() => import('@/pages/ProductsPage')) },
                  {
                    path: ROUTES.productImports,
                    lazy: page(() => import('@/pages/ProductImportsPage')),
                  },
                  {
                    path: ROUTES.productTrash,
                    lazy: page(() => import('@/pages/ProductTrashPage')),
                  },
                  { path: ROUTES.categories, lazy: page(() => import('@/pages/CategoriesPage')) },
                  { path: ROUTES.orders, lazy: page(() => import('@/pages/OrdersPage')) },
                  {
                    path: ROUTES.orderDetail,
                    lazy: page(() => import('@/pages/OrderDetailPage')),
                  },
                  { path: ROUTES.purchases, lazy: page(() => import('@/pages/PurchasesPage')) },
                  {
                    path: ROUTES.purchaseNew,
                    lazy: page(() => import('@/pages/PurchaseNewPage')),
                  },
                  {
                    path: ROUTES.purchaseDetail,
                    lazy: page(() => import('@/pages/PurchaseDetailPage')),
                  },
                  { path: ROUTES.inventory, lazy: page(() => import('@/pages/InventoryPage')) },
                  {
                    path: ROUTES.inventoryStocktake,
                    lazy: page(() => import('@/pages/InventoryStocktakePage')),
                  },
                  { path: ROUTES.analytics, lazy: page(() => import('@/pages/AnalyticsPage')) },
                  {
                    path: ROUTES.analyticsRevenueReport,
                    lazy: page(() => import('@/pages/RevenueReportPage')),
                  },
                ],
              },
            ],
          },
          {
            element: <RoleGuard allow={['admin']} />,
            children: [
              {
                path: ROUTES.admin,
                Component: AdminLayout,
                children: [
                  { index: true, lazy: page(() => import('@/pages/AdminDashboardPage')) },
                  {
                    path: ROUTES.adminAccounts,
                    lazy: page(() => import('@/pages/AdminAccountsPage')),
                  },
                  {
                    path: ROUTES.adminApprovals,
                    lazy: page(() => import('@/pages/AdminApprovalsPage')),
                  },
                  {
                    path: ROUTES.adminSellers,
                    lazy: page(() => import('@/pages/AdminSellersPage')),
                  },
                  {
                    path: ROUTES.adminSellerDetail,
                    lazy: page(() => import('@/pages/AdminSellerDetailPage')),
                  },
                  {
                    path: ROUTES.adminDeletions,
                    lazy: page(() => import('@/pages/AdminDeletionsPage')),
                  },
                  {
                    path: ROUTES.adminAuditLog,
                    lazy: page(() => import('@/pages/AdminAuditLogPage')),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    Component: GuestRoute,
    ...common,
    children: [
      { path: ROUTES.login, lazy: page(() => import('@/pages/LoginPage')) },
      { path: ROUTES.register, lazy: page(() => import('@/pages/RegisterPage')) },
      { path: ROUTES.verifyEmail, lazy: page(() => import('@/pages/VerifyEmailPage')) },
      { path: ROUTES.forgotPassword, lazy: page(() => import('@/pages/ForgotPasswordPage')) },
    ],
  },
  {
    path: ROUTES.resetPassword,
    lazy: page(() => import('@/pages/ResetPasswordPage')),
    ...common,
  },
  {
    path: '*',
    lazy: page(() => import('@/pages/NotFoundPage')),
    ...common,
  },
])
