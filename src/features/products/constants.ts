/** Đơn vị tính (ĐVT) dùng cho sản phẩm, phiếu nhập và file Excel mẫu. */
export const PRODUCT_UNITS = ['Cái', 'Chiếc', 'Đôi', 'Bộ', 'Hộp', 'Gói'] as const

export type ProductUnit = (typeof PRODUCT_UNITS)[number]

export const DEFAULT_PRODUCT_UNIT: ProductUnit = 'Cái'

export function isProductUnit(value: unknown): value is ProductUnit {
  return (PRODUCT_UNITS as readonly unknown[]).includes(value)
}
