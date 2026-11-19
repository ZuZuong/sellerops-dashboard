import { createBrowserRouter } from 'react-router'
import {
  AccountGate,
  GuestRoute,
  HomeRedirect,
  prefetchAccount,
  ProtectedRoute,
  RoleGuard,
} from '@/features/auth'
import { prefetchOwnSeller } from '@/features/sellers'
import { PageLoader } from '@/shared/components/PageLoader'
import { ROUTES } from '@/shared/constants/routes'
import { queryClient } from '@/shared/lib/queryClient'
import { adminPages, page, preloadWhenIdle, sellerPages } from './pages'
import { RouteErrorBoundary } from './RouteErrorBoundary'

const common = { ErrorBoundary: RouteErrorBoundary, HydrateFallback: PageLoader }

/**
 * Loader chỉ KHỞI ĐỘNG việc tải dữ liệu rồi trả về ngay (không chặn điều hướng): tài khoản, shop
 * và code trang được tải SONG SONG thay vì nối tiếp nhau (phiên → tài khoản → shop → trang).
 */
const prefetch = (task: () => Promise<void>) => () => {
  void task().catch(() => undefined)
  return null
}

/**
 * Cây route:
 *   khách (GuestRoute)        /login /register /verify-email /forgot-password
 *   công khai                 /reset-password (phiên khôi phục từ link trong thư)
 *   đã đăng nhập (Protected → AccountGate: đọc role từ profiles, chặn tài khoản khóa / bị xóa)
 *     /                       chuyển hướng theo role
 *     /no-access              tài khoản người mua
 *     /seller/*  (seller)     SellerLayout: SellerScope + khóa theo trạng thái shop
 *     /admin/*   (admin)      AdminLayout: Admin Console (xem shop ở chế độ chỉ đọc)
 * Layout của từng vai trò cũng lazy-load: seller không tải code Admin Console và ngược lại.
 */
export const router = createBrowserRouter([
  {
    Component: ProtectedRoute,
    loader: prefetch(() => prefetchAccount(queryClient)),
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
                loader: prefetch(async () => {
                  preloadWhenIdle(sellerPages)
                  await prefetchOwnSeller(queryClient)
                }),
                lazy: async () => ({
                  Component: (await import('@/layouts/SellerLayout')).SellerLayout,
                }),
                children: [
                  { index: true, lazy: page(sellerPages.dashboard) },
                  { path: ROUTES.products, lazy: page(sellerPages.products) },
                  { path: ROUTES.productImports, lazy: page(sellerPages.productImports) },
                  { path: ROUTES.productTrash, lazy: page(sellerPages.productTrash) },
                  { path: ROUTES.categories, lazy: page(sellerPages.categories) },
                  { path: ROUTES.orders, lazy: page(sellerPages.orders) },
                  { path: ROUTES.orderDetail, lazy: page(sellerPages.orderDetail) },
                  { path: ROUTES.purchases, lazy: page(sellerPages.purchases) },
                  { path: ROUTES.purchaseNew, lazy: page(sellerPages.purchaseNew) },
                  { path: ROUTES.purchaseDetail, lazy: page(sellerPages.purchaseDetail) },
                  { path: ROUTES.inventory, lazy: page(sellerPages.inventory) },
                  { path: ROUTES.inventoryStocktake, lazy: page(sellerPages.inventoryStocktake) },
                  { path: ROUTES.analytics, lazy: page(sellerPages.analytics) },
                  {
                    path: ROUTES.analyticsRevenueReport,
                    lazy: page(sellerPages.analyticsRevenueReport),
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
                loader: prefetch(async () => preloadWhenIdle(adminPages)),
                lazy: async () => ({
                  Component: (await import('@/layouts/AdminLayout')).AdminLayout,
                }),
                children: [
                  { index: true, lazy: page(adminPages.dashboard) },
                  { path: ROUTES.adminAccounts, lazy: page(adminPages.accounts) },
                  { path: ROUTES.adminApprovals, lazy: page(adminPages.approvals) },
                  { path: ROUTES.adminSellers, lazy: page(adminPages.sellers) },
                  { path: ROUTES.adminSellerDetail, lazy: page(adminPages.sellerDetail) },
                  { path: ROUTES.adminDeletions, lazy: page(adminPages.deletions) },
                  { path: ROUTES.adminAuditLog, lazy: page(adminPages.auditLog) },
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
