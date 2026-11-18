import type { Enums } from '@/shared/types/database.types'

export type PaymentMethod = Enums<'payment_method'>

export const PAYMENT_METHODS = [
  'cod',
  'bank_transfer',
  'cash',
  'card',
  'e_wallet',
] as const satisfies readonly PaymentMethod[]

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'cod'

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  cash: 'Tiền mặt tại cửa hàng',
  card: 'Thẻ ngân hàng / POS',
  e_wallet: 'Ví điện tử (MoMo, ZaloPay…)',
}

/** Nhãn ngắn cho bảng / chứng từ. Đơn cũ (trước khi có trường này) → "Không rõ". */
export function getPaymentMethodLabel(method: PaymentMethod | null | undefined): string {
  return method ? PAYMENT_METHOD_LABELS[method] : 'Không rõ'
}

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}))

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value)
}
