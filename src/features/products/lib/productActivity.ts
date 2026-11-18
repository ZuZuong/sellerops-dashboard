import {
  change,
  diffRecords,
  type ActivityChange,
  type DiffField,
} from '@/shared/lib/activityChanges'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import type { Product } from '../types'

/** Chi tiết "cũ → mới" của sản phẩm cho nhật ký hoạt động. */

type ProductFields = Pick<
  Product,
  | 'name'
  | 'sku'
  | 'category'
  | 'unit'
  | 'price'
  | 'cost_price'
  | 'low_stock_threshold'
  | 'is_active'
  | 'description'
  | 'hero_image_path'
  | 'image_paths'
>

export const activeLabel = (isActive: boolean) => (isActive ? 'Đang bán' : 'Chưa đăng / ngừng bán')

const imageCount = (p: ProductFields) => (p.hero_image_path ? 1 : 0) + p.image_paths.length

const FIELDS: readonly DiffField<ProductFields>[] = [
  { field: 'Tên', value: (p) => p.name },
  { field: 'Danh mục', value: (p) => p.category },
  { field: 'Đơn vị tính', value: (p) => p.unit },
  { field: 'Giá vốn', value: (p) => formatCurrency(p.cost_price) },
  { field: 'Giá bán', value: (p) => formatCurrency(p.price) },
  { field: 'Ngưỡng cảnh báo tồn', value: (p) => formatNumber(p.low_stock_threshold) },
  { field: 'Trạng thái', value: (p) => activeLabel(p.is_active) },
  { field: 'Mô tả', value: (p) => p.description },
  { field: 'Số ảnh', value: (p) => `${imageCount(p)} ảnh` },
]

/** Sửa sản phẩm: chỉ các trường thực sự đổi (+ ảnh đại diện nếu đã thay). */
export function productUpdateChanges(
  before: ProductFields,
  after: ProductFields,
): ActivityChange[] {
  const changes = diffRecords(before, after, FIELDS)
  const heroReplaced =
    before.hero_image_path !== null &&
    after.hero_image_path !== null &&
    before.hero_image_path !== after.hero_image_path
  if (heroReplaced) changes.push(change('Ảnh đại diện', 'Ảnh cũ', 'Ảnh mới'))
  return changes
}

/** Tạo sản phẩm: toàn bộ giá trị ban đầu (cũ = trống). */
export function productCreateChanges(product: ProductFields): ActivityChange[] {
  return [
    change('SKU', null, product.sku),
    ...FIELDS.map(({ field, value }) => change(field, null, value(product))),
  ].filter((c) => c.to !== null)
}
