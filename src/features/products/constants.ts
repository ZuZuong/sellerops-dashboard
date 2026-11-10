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
