import { PRODUCT_UNITS } from '../constants'
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS } from './importProducts'

/** Đuôi file chấp nhận khi nhập (SheetJS đọc được cả .xls và .csv). */
export const SPREADSHEET_ACCEPT = '.xlsx,.xls,.csv'
export const MAX_SPREADSHEET_SIZE = 5 * 1024 * 1024
export const TEMPLATE_FILE_NAME = 'mau-nhap-san-pham.xlsx'
/** Phiên bản file mẫu — ghi trong sheet Hướng dẫn để đối chiếu khi doanh nghiệp dùng file cũ. */
export const TEMPLATE_VERSION = '2.0'

/** Tên sheet dữ liệu trong file mẫu (phải là sheet ĐẦU TIÊN — trình nhập đọc sheet đầu). */
export const TEMPLATE_DATA_SHEET = 'Sản phẩm'

/*
 * SheetJS khá nặng (~400 KB) → import động, chỉ tải khi người dùng thật sự nhập / tải file mẫu.
 */

export interface SpreadsheetContent {
  /** Tên sheet đã đọc (sheet đầu tiên). */
  sheetName: string | null
  /** Mảng 2 chiều (dòng × ô); chỉ số dòng khớp số dòng trong Excel − 1. */
  rows: unknown[][]
}

/** Đọc sheet đầu tiên của file thành mảng 2 chiều (dòng × ô). */
export async function readSpreadsheet(file: File): Promise<SpreadsheetContent> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheetName = workbook.SheetNames[0] ?? null
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet?.['!ref']) return { sheetName, rows: [] }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    // Giữ dòng trống để chỉ số mảng khớp số dòng trong Excel khi báo lỗi "Dòng N".
    blankrows: true,
    raw: true,
  })
  // Sheet có thể bắt đầu từ dòng > 1 (vd. A3): chèn dòng trống phía trước để số dòng không lệch.
  const firstRow = XLSX.utils.decode_range(sheet['!ref']).s.r
  return { sheetName, rows: [...Array.from({ length: firstRow }, () => []), ...rows] }
}

/** Dòng ví dụ thứ hai (khác danh mục / ĐVT) để doanh nghiệp thấy rõ cách điền. */
const SECOND_EXAMPLE = [
  'Giày sneaker trắng',
  'Giày dép',
  'Đôi',
  320000,
  550000,
  12,
  3,
  'Size 38–43',
]

/** Nội dung sheet "Hướng dẫn": quy tắc chung + mô tả từng cột. */
export function buildGuideRows(): (string | number)[][] {
  return [
    [`HƯỚNG DẪN NHẬP SẢN PHẨM TỪ EXCEL (mẫu v${TEMPLATE_VERSION})`],
    [],
    ['Quy tắc chung'],
    [
      `1. Điền dữ liệu vào sheet "${TEMPLATE_DATA_SHEET}" (sheet đầu tiên). Giữ nguyên dòng tiêu đề.`,
    ],
    ['2. Mỗi dòng là một sản phẩm. Dòng trống được bỏ qua. Xóa 2 dòng ví dụ trước khi nhập.'],
    [
      `3. Tối đa ${MAX_IMPORT_ROWS} sản phẩm mỗi lần nhập. Chỉ cần một dòng lỗi thì cả file chưa được lưu.`,
    ],
    ['4. Cột có dấu * là bắt buộc. SKU do hệ thống tự sinh — không cần điền.'],
    ['5. Giá ghi số nguyên VND, có thể viết 150000 hoặc 150.000. Không ghi chữ (vd. "150k").'],
    [
      '6. Giá vốn là giá nhập 1 đơn vị (chưa VAT). Số lượng được ghi vào kho làm tồn đầu kỳ theo giá vốn này.',
    ],
    [
      '7. Sau khi nhập, hàng nhập thêm nên đi qua Phiếu nhập kho để giá vốn được tính bình quân tự động.',
    ],
    [],
    ['Cột', 'Bắt buộc', 'Định dạng', 'Ví dụ'],
    ...IMPORT_COLUMNS.map((column) => [
      column.label,
      column.required ? 'Có' : 'Không',
      column.format,
      column.example,
    ]),
  ]
}

/**
 * Tạo và tải file Excel mẫu chuẩn:
 *  - "Sản phẩm": dòng tiêu đề + 2 dòng ví dụ (sheet đầu, trình nhập đọc sheet này).
 *  - "Hướng dẫn": quy tắc và định dạng từng cột.
 *  - "Danh mục", "Đơn vị tính": danh sách giá trị hợp lệ.
 */
export async function downloadImportTemplate(categories: readonly string[]): Promise<void> {
  const XLSX = await import('xlsx')
  const header = IMPORT_COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label))
  // Dòng ví dụ dùng danh mục thật của cửa hàng để nhập thử được ngay.
  const categoryIndex = IMPORT_COLUMNS.findIndex((c) => c.field === 'category')
  const withCategory = (row: readonly (string | number)[], category: string | undefined) =>
    row.map((cell, index) => (index === categoryIndex && category ? category : cell))
  const example = withCategory(
    IMPORT_COLUMNS.map((c) => c.example),
    categories[0],
  )
  const second = withCategory(SECOND_EXAMPLE, categories[1] ?? categories[0])

  const productSheet = XLSX.utils.aoa_to_sheet([header, example, second])
  productSheet['!cols'] = IMPORT_COLUMNS.map((c) => ({ wch: c.width }))

  const guideSheet = XLSX.utils.aoa_to_sheet(buildGuideRows())
  guideSheet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 56 }, { wch: 30 }]

  const categorySheet = XLSX.utils.aoa_to_sheet([
    ['Danh mục hợp lệ'],
    ...categories.map((category) => [category]),
  ])
  categorySheet['!cols'] = [{ wch: 24 }]

  const unitSheet = XLSX.utils.aoa_to_sheet([
    ['Đơn vị tính hợp lệ'],
    ...PRODUCT_UNITS.map((unit) => [unit]),
  ])
  unitSheet['!cols'] = [{ wch: 20 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, productSheet, TEMPLATE_DATA_SHEET)
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn')
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Danh mục')
  XLSX.utils.book_append_sheet(workbook, unitSheet, 'Đơn vị tính')
  XLSX.writeFile(workbook, TEMPLATE_FILE_NAME)
}
