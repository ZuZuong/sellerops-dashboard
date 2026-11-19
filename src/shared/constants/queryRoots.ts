/**
 * Gốc query key của từng nhóm dữ liệu. Feature A cần làm mới dữ liệu của feature B (vd. đổi tên
 * danh mục → danh sách sản phẩm hiển thị tên mới) dùng gốc ở đây thay vì import lẫn nhau.
 */
export const QUERY_ROOTS = {
  products: 'products',
  categories: 'categories',
  dashboard: 'dashboard',
} as const
