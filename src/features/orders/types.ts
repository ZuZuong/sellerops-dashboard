import type { Tables } from '@/shared/types/database.types'

export type Order = Pick<
  Tables<'orders'>,
  'id' | 'code' | 'customer_name' | 'customer_phone' | 'status' | 'total' | 'created_at'
>

export interface OrderPage {
  items: Order[]
  total: number
}

export interface OrderItem extends Pick<
  Tables<'order_items'>,
  'id' | 'product_id' | 'quantity' | 'unit_price' | 'unit_cost'
> {
  /** Sản phẩm hiện tại (tên / SKU / tồn kho có thể đã đổi sau khi đặt; giá chốt nằm ở unit_price). */
  product: Pick<Tables<'products'>, 'id' | 'name' | 'sku' | 'stock' | 'is_active'> | null
}

export type OrderStatusEvent = Pick<Tables<'order_status_events'>, 'id' | 'status' | 'created_at'>

export interface OrderDetail extends Order {
  items: OrderItem[]
  events: OrderStatusEvent[]
}

/** Sản phẩm có thể thêm vào đơn mới (đang bán). */
export type OrderableProduct = Pick<Tables<'products'>, 'id' | 'name' | 'sku' | 'price' | 'stock'>
