import { toCsv, type CsvColumn } from '@/shared/lib/csv'
import type { InventoryItem } from '../types'

export function getStockLevelLabel(item: Pick<InventoryItem, 'stock' | 'is_low_stock'>): string {
  if (item.stock === 0) return 'Hết hàng'
  if (item.is_low_stock) return 'Sắp hết'
  return 'Còn hàng'
}

const COLUMNS: readonly CsvColumn<InventoryItem>[] = [
  { header: 'SKU', value: (item) => item.sku },
  { header: 'Tên sản phẩm', value: (item) => item.name },
  { header: 'Danh mục', value: (item) => item.category },
  { header: 'ĐVT', value: (item) => item.unit },
  { header: 'Giá vốn (VND)', value: (item) => Math.round(item.cost_price) },
  { header: 'Giá bán (VND)', value: (item) => item.price },
  { header: 'Tồn kho', value: (item) => item.stock },
  { header: 'Ngưỡng cảnh báo', value: (item) => item.low_stock_threshold },
  {
    header: 'Giá trị tồn theo giá vốn (VND)',
    value: (item) => Math.round(item.stock * item.cost_price),
  },
  { header: 'Giá trị tồn theo giá bán (VND)', value: (item) => item.stock * item.price },
  { header: 'Mức tồn', value: getStockLevelLabel },
  { header: 'Trạng thái bán', value: (item) => (item.is_active ? 'Đang bán' : 'Ngừng bán') },
]

/** Số là số thô (không định dạng "1.250.000 ₫") để Excel cộng / lọc được. */
export function inventoryToCsv(items: readonly InventoryItem[]): string {
  return toCsv(items, COLUMNS)
}
