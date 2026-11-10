import { PRODUCT_CATEGORIES } from '../constants'
import { IMPORT_COLUMNS } from './importProducts'

/** Đuôi file chấp nhận khi nhập (SheetJS đọc được cả .xls và .csv). */
export const SPREADSHEET_ACCEPT = '.xlsx,.xls,.csv'
export const MAX_SPREADSHEET_SIZE = 5 * 1024 * 1024
export const TEMPLATE_FILE_NAME = 'mau-nhap-san-pham.xlsx'

/*
 * SheetJS khá nặng (~400 KB) → import động, chỉ tải khi người dùng thật sự nhập / tải file mẫu.
 */

/** Đọc sheet đầu tiên của file thành mảng 2 chiều (dòng × ô). */
export async function readSpreadsheet(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
  if (!sheet?.['!ref']) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    // Giữ dòng trống để chỉ số mảng khớp số dòng trong Excel khi báo lỗi "Dòng N".
    blankrows: true,
    raw: true,
  })
  // Sheet có thể bắt đầu từ dòng > 1 (vd. A3): chèn dòng trống phía trước để số dòng không lệch.
  const firstRow = XLSX.utils.decode_range(sheet['!ref']).s.r
  return [...Array.from({ length: firstRow }, () => []), ...rows]
}

/** Tạo và tải file Excel mẫu: sheet "Sản phẩm" (tiêu đề + dòng ví dụ) và sheet "Danh mục". */
export async function downloadImportTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const header = IMPORT_COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label))
  const example = ['Áo thun cotton basic', 'Áo thun', 150000, 50, 5, 'Chất liệu cotton 100%']

  const productSheet = XLSX.utils.aoa_to_sheet([header, example])
  productSheet['!cols'] = [
    { wch: 32 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 40 },
  ]

  const categorySheet = XLSX.utils.aoa_to_sheet([
    ['Danh mục hợp lệ'],
    ...PRODUCT_CATEGORIES.map((category) => [category]),
  ])
  categorySheet['!cols'] = [{ wch: 24 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, productSheet, 'Sản phẩm')
  XLSX.utils.book_append_sheet(workbook, categorySheet, 'Danh mục')
  XLSX.writeFile(workbook, TEMPLATE_FILE_NAME)
}
