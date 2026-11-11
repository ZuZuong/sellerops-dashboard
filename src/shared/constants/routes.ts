export const ROUTES = {
  dashboard: '/',
  products: '/products',
  orders: '/orders',
  orderDetail: '/orders/:orderId',
  inventory: '/inventory',
  analytics: '/analytics',
  login: '/login',
} as const

/** Đường dẫn trang chi tiết đơn hàng. */
export const orderDetailPath = (orderId: string) => `${ROUTES.orders}/${orderId}`
