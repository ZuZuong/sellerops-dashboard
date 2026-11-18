import { columnLetter, formula, type XlsxCell, type XlsxSheet } from '@/shared/lib/xlsxExport'
import type { InventoryItem } from '../types'

/**
 * Biên bản kiểm kê hàng hóa (bố cục theo Mẫu số 05-VT, Thông tư 200/2014/TT-BTC).
 * Số liệu "theo sổ sách" lấy từ tồn kho hệ thống; cột "theo kiểm kê" và "chênh lệch" để trống cho
 * ban kiểm kê ghi khi đếm thực tế (file Excel tự tính thành tiền và thừa / thiếu khi nhập số đếm).
 */

export type StocktakeItem = Pick<
  InventoryItem,
  'id' | 'sku' | 'name' | 'category' | 'unit' | 'cost_price' | 'stock'
>

export interface StocktakeLine {
  id: string
  index: number
  name: string
  sku: string
  category: string | null
  unit: string
  unitCost: number
  bookQty: number
  bookAmount: number
}

export interface StocktakeSheet {
  lines: StocktakeLine[]
  totalQty: number
  totalAmount: number
}

const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true })

/** Sắp theo danh mục rồi tên (đúng thứ tự đi kiểm trên kệ); sản phẩm chưa có danh mục xếp cuối. */
export function buildStocktakeSheet(items: readonly StocktakeItem[]): StocktakeSheet {
  const sorted = [...items].sort((a, b) => {
    if (a.category !== b.category) {
      if (a.category === null) return 1
      if (b.category === null) return -1
      const byCategory = collator.compare(a.category, b.category)
      if (byCategory !== 0) return byCategory
    }
    return collator.compare(a.name, b.name) || collator.compare(a.sku, b.sku)
  })

  const lines = sorted.map((item, i) => ({
    id: item.id,
    index: i + 1,
    name: item.name,
    sku: item.sku,
    category: item.category,
    unit: item.unit,
    unitCost: Math.round(item.cost_price),
    bookQty: item.stock,
    bookAmount: Math.round(item.stock * item.cost_price),
  }))

  return {
    lines,
    totalQty: lines.reduce((sum, line) => sum + line.bookQty, 0),
    totalAmount: lines.reduce((sum, line) => sum + line.bookAmount, 0),
  }
}

export const STOCKTAKE_SIGNERS = [
  'Giám đốc',
  'Kế toán trưởng',
  'Thủ kho',
  'Trưởng ban kiểm kê',
] as const

/** Cột của bảng kiểm kê trong file Excel (A → L). */
const COLUMN_WIDTHS = [6, 36, 20, 8, 14, 12, 16, 12, 16, 10, 10, 22]
const LAST_COLUMN = columnLetter(COLUMN_WIDTHS.length - 1)

export interface StocktakeMeta {
  companyName: string
  /** Thời điểm chốt số liệu sổ sách, đã định dạng. */
  bookAsOf: string
  scopeLabel: string
}

/**
 * Bảng tính kiểm kê: tiêu đề chứng từ, bảng hàng với công thức Excel cho cột kiểm kê / chênh lệch,
 * dòng cộng và chỗ ký. Người kiểm chỉ cần nhập cột "SL kiểm kê" (H) và ghi chú.
 */
export function stocktakeToXlsx(sheet: StocktakeSheet, meta: StocktakeMeta): XlsxSheet {
  const rows: XlsxCell[][] = [
    [meta.companyName, null, null, null, null, null, null, null, null, null, 'Mẫu số 05-VT'],
    [
      'Bộ phận: Kho hàng',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      '(Theo TT 200/2014/TT-BTC)',
    ],
    [],
    ['BIÊN BẢN KIỂM KÊ VẬT TƯ, CÔNG CỤ, SẢN PHẨM, HÀNG HÓA'],
    ['Thời điểm kiểm kê: ...... giờ ...... ngày ...... tháng ...... năm ......'],
    [`Số liệu sổ sách chốt lúc: ${meta.bookAsOf} · Phạm vi: ${meta.scopeLabel}`],
    [
      'Ban kiểm kê gồm: 1) Ông/Bà ................................ Chức vụ ............... Trưởng ban',
    ],
    ['                 2) Ông/Bà ................................ Chức vụ ............... Ủy viên'],
    ['                 3) Ông/Bà ................................ Chức vụ ............... Ủy viên'],
    [],
    [
      'STT',
      'Tên hàng hóa',
      'Mã số (SKU)',
      'ĐVT',
      'Đơn giá (giá vốn)',
      'Theo sổ sách',
      null,
      'Theo kiểm kê',
      null,
      'Chênh lệch',
      null,
      'Phẩm chất / Ghi chú',
    ],
    [
      null,
      null,
      null,
      null,
      null,
      'Số lượng',
      'Thành tiền',
      'Số lượng',
      'Thành tiền',
      'Thừa',
      'Thiếu',
      null,
    ],
  ]

  const headerTop = 11 // dòng Excel (1-based) của hàng tiêu đề đầu tiên
  const firstDataRow = headerTop + 2
  sheet.lines.forEach((line, i) => {
    const r = firstDataRow + i
    rows.push([
      line.index,
      line.name,
      line.sku,
      line.unit,
      line.unitCost,
      line.bookQty,
      line.bookAmount,
      null,
      formula(`IF(H${r}="","",H${r}*E${r})`),
      formula(`IF(H${r}="","",MAX(H${r}-F${r},0))`),
      formula(`IF(H${r}="","",MAX(F${r}-H${r},0))`),
      null,
    ])
  })

  const lastDataRow = firstDataRow + sheet.lines.length - 1
  const totalRow = lastDataRow + 1
  const sum = (col: string) =>
    sheet.lines.length > 0 ? formula(`SUM(${col}${firstDataRow}:${col}${lastDataRow})`) : 0
  rows.push([
    'Cộng',
    null,
    null,
    null,
    null,
    sheet.totalQty,
    sheet.totalAmount,
    sum('H'),
    sum('I'),
    sum('J'),
    sum('K'),
    null,
  ])
  rows.push([])
  rows.push(['Ý kiến giải quyết số chênh lệch: ' + '.'.repeat(120)])
  rows.push([])
  rows.push([
    STOCKTAKE_SIGNERS[0],
    null,
    STOCKTAKE_SIGNERS[1],
    null,
    null,
    STOCKTAKE_SIGNERS[2],
    null,
    null,
    STOCKTAKE_SIGNERS[3],
  ])
  rows.push([
    '(Ký, họ tên, đóng dấu)',
    null,
    '(Ký, họ tên)',
    null,
    null,
    '(Ký, họ tên)',
    null,
    null,
    '(Ký, họ tên)',
  ])

  const fullRow = (row: number) => `A${row}:${LAST_COLUMN}${row}`
  return {
    name: 'Kiểm kê',
    rows,
    columnWidths: COLUMN_WIDTHS,
    merges: [
      fullRow(4),
      fullRow(5),
      fullRow(6),
      `A${headerTop}:A${headerTop + 1}`,
      `B${headerTop}:B${headerTop + 1}`,
      `C${headerTop}:C${headerTop + 1}`,
      `D${headerTop}:D${headerTop + 1}`,
      `E${headerTop}:E${headerTop + 1}`,
      `F${headerTop}:G${headerTop}`,
      `H${headerTop}:I${headerTop}`,
      `J${headerTop}:K${headerTop}`,
      `L${headerTop}:L${headerTop + 1}`,
      `A${totalRow}:E${totalRow}`,
    ],
  }
}
