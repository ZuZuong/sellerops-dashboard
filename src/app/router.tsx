import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { PageLoader } from '@/shared/components/PageLoader'
import { ROUTES } from '@/shared/constants/routes'
import { RouteErrorBoundary } from './RouteErrorBoundary'

/** Lazy-load một page (default export) theo route để code-split. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const router = createBrowserRouter([
  {
    path: ROUTES.dashboard,
    Component: DashboardLayout,
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: PageLoader,
    children: [
      { index: true, lazy: page(() => import('@/pages/DashboardPage')) },
      { path: ROUTES.products, lazy: page(() => import('@/pages/ProductsPage')) },
      { path: ROUTES.orders, lazy: page(() => import('@/pages/OrdersPage')) },
      { path: ROUTES.inventory, lazy: page(() => import('@/pages/InventoryPage')) },
      { path: ROUTES.analytics, lazy: page(() => import('@/pages/AnalyticsPage')) },
    ],
  },
  {
    path: '*',
    lazy: page(() => import('@/pages/NotFoundPage')),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: PageLoader,
  },
])
