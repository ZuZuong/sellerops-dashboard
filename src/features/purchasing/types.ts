import type { Tables } from '@/shared/types/database.types'

type Receipt = Tables<'purchase_receipts'>
type ReceiptItemRow = Tables<'purchase_receipt_items'>

export type PurchaseReceipt = Pick<
  Receipt,
  | 'id'
  | 'code'
  | 'status'
  | 'supplier_name'
  | 'supplier_phone'
  | 'invoice_number'
  | 'received_date'
  | 'total_amount'
  | 'created_at'
  | 'posted_at'
> & {
  /** Tổng SL thực nhận / lỗi của phiếu (cộng từ các dòng). */
  received_qty: number
  defective_qty: number
}

export interface PurchaseReceiptPage {
  items: PurchaseReceipt[]
  total: number
}

/** Sản phẩm chọn được trên phiếu nhập (kèm tồn + giá vốn để xem trước giá vốn mới). */
export type ReceiptProduct = Pick<
  Tables<'products'>,
  'id' | 'name' | 'sku' | 'unit' | 'stock' | 'cost_price'
>

export interface ReceiptItem extends Pick<
  ReceiptItemRow,
  | 'id'
  | 'product_id'
  | 'ordered_qty'
  | 'received_qty'
  | 'defective_qty'
  | 'unit_cost'
  | 'condition_note'
  | 'position'
> {
  product: ReceiptProduct | null
}

export interface ReceiptDetail extends Pick<
  Receipt,
  | 'id'
  | 'code'
  | 'status'
  | 'supplier_name'
  | 'supplier_phone'
  | 'invoice_number'
  | 'delivered_by'
  | 'received_date'
  | 'note'
  | 'total_amount'
  | 'created_at'
  | 'updated_at'
  | 'posted_at'
> {
  items: ReceiptItem[]
}
