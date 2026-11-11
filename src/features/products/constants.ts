/** Danh mục sản phẩm của cửa hàng thời trang (dùng cho form và bộ lọc). */
export const PRODUCT_CATEGORIES = [
  'Áo thun',
  'Áo sơ mi',
  'Áo polo',
  'Áo khoác',
  'Áo len',
  'Quần jean',
  'Quần tây',
  'Quần short',
  'Chân váy',
  'Đầm',
  'Đồ bộ',
  'Đồ thể thao',
  'Đồ lót',
  'Giày dép',
  'Túi xách',
  'Phụ kiện',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export function isProductCategory(value: unknown): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly unknown[]).includes(value)
}

/** Đơn vị tính (ĐVT) dùng cho sản phẩm, phiếu nhập và file Excel mẫu. */
export const PRODUCT_UNITS = ['Cái', 'Chiếc', 'Đôi', 'Bộ', 'Hộp', 'Gói'] as const

export type ProductUnit = (typeof PRODUCT_UNITS)[number]

export const DEFAULT_PRODUCT_UNIT: ProductUnit = 'Cái'

export function isProductUnit(value: unknown): value is ProductUnit {
  return (PRODUCT_UNITS as readonly unknown[]).includes(value)
}
