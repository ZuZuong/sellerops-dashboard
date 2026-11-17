import type { ProductCategoryOverview } from '../types'

/** Danh mục dùng trong test (trùng bộ danh mục mặc định DB tạo cho tài khoản mới). */
export const TEST_CATEGORIES = [
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

/** Kết quả giả của `fetchProductCategories`. */
export const testCategoryOverview = (
  names: readonly string[] = TEST_CATEGORIES,
): ProductCategoryOverview[] =>
  names.map((name, index) => ({
    id: `cat-${index + 1}`,
    name,
    product_count: 0,
    active_count: 0,
    created_at: '2026-11-01T00:00:00Z',
  }))
