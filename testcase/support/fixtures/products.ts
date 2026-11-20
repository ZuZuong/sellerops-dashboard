import type { CategoryOverview } from '@/features/categories'

/** Danh mục dùng trong test (shop tự tạo — không có danh mục mẫu). */
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

/** Id dạng UUID hợp lệ (schema form / bộ lọc kiểm tra uuid) cho danh mục thứ `index` (từ 0). */
export const testCategoryId = (index: number) =>
  `c0000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`

/** Id của danh mục theo tên trong TEST_CATEGORIES. */
export const categoryIdOf = (name: (typeof TEST_CATEGORIES)[number]) =>
  testCategoryId(TEST_CATEGORIES.indexOf(name))

/** Kết quả giả của `fetchCategories`. */
export const testCategoryOverview = (
  names: readonly string[] = TEST_CATEGORIES,
): CategoryOverview[] =>
  names.map((name, index) => ({
    id: testCategoryId(index),
    name,
    slug: `danh-muc-${index + 1}`,
    sort_order: index,
    is_active: true,
    product_count: 0,
    active_count: 0,
    created_at: '2026-11-01T00:00:00Z',
  }))
