export const ROUTES = {
  dashboard: '/',
  products: '/products',
  productImports: '/products/imports',
  orders: '/orders',
  orderDetail: '/orders/:orderId',
  purchases: '/purchases',
  purchaseNew: '/purchases/new',
  purchaseDetail: '/purchases/:receiptId',
  inventory: '/inventory',
  analytics: '/analytics',
  login: '/login',
} as const

/** Đường dẫn trang chi tiết đơn hàng. */
export const orderDetailPath = (orderId: string) => `${ROUTES.orders}/${orderId}`

/** Đường dẫn trang chi tiết phiếu nhập kho. */
export const purchaseDetailPath = (receiptId: string) => `${ROUTES.purchases}/${receiptId}`
