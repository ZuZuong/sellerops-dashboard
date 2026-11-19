/**
 * Ba nhóm route theo vai trò: khách (đăng nhập / đăng ký…), seller (`/seller/*`), admin
 * (`/admin/*`). `/` tự chuyển hướng theo role của người đăng nhập.
 */
export const ROUTES = {
  home: '/',

  // Khách / tài khoản
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  noAccess: '/no-access',

  // Seller
  dashboard: '/seller',
  products: '/seller/products',
  productImports: '/seller/products/imports',
  productTrash: '/seller/products/trash',
  categories: '/seller/categories',
  orders: '/seller/orders',
  orderDetail: '/seller/orders/:orderId',
  purchases: '/seller/purchases',
  purchaseNew: '/seller/purchases/new',
  purchaseDetail: '/seller/purchases/:receiptId',
  inventory: '/seller/inventory',
  inventoryStocktake: '/seller/inventory/stocktake',
  analytics: '/seller/analytics',
  analyticsRevenueReport: '/seller/analytics/revenue-report',

  // Admin
  admin: '/admin',
  adminAccounts: '/admin/accounts',
  adminApprovals: '/admin/approvals',
  adminSellers: '/admin/sellers',
  adminSellerDetail: '/admin/sellers/:sellerId',
  adminDeletions: '/admin/deletions',
  adminAuditLog: '/admin/audit-log',
} as const

/** Đường dẫn trang chi tiết đơn hàng. */
export const orderDetailPath = (orderId: string) => `${ROUTES.orders}/${orderId}`

/** Đường dẫn trang chi tiết phiếu nhập kho. */
export const purchaseDetailPath = (receiptId: string) => `${ROUTES.purchases}/${receiptId}`

/** Trang chi tiết shop trong Admin Console (tùy chọn mở sẵn một tab). */
export const adminSellerPath = (sellerId: string, tab?: string) =>
  `${ROUTES.adminSellers}/${sellerId}${tab ? `?tab=${tab}` : ''}`
