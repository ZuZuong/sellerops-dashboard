/**
 * Xuất chứng từ / báo cáo ra file Excel (.xlsx). Thư viện `xlsx` được tải động khi người dùng bấm
 * xuất, không nằm trong bundle chính.
 *
 * Ô dạng chuỗi luôn được ghi là văn bản (không phải công thức) → dữ liệu người dùng nhập như
 * "=SUM(…)" không bị Excel thực thi. Công thức chỉ được tạo có chủ đích qua `formula()`.
 */

export interface XlsxFormula {
  readonly kind: 'formula'
  readonly f: string
}

export type XlsxCell = string | number | null | XlsxFormula

export interface XlsxSheet {
  name: string
  rows: readonly (readonly XlsxCell[])[]
  /** Độ rộng cột (số ký tự). */
  columnWidths?: readonly number[]
  /** Vùng gộp ô, dạng "A1:L1". */
  merges?: readonly string[]
}

export const formula = (f: string): XlsxFormula => ({ kind: 'formula', f })

const isFormula = (cell: XlsxCell): cell is XlsxFormula =>
  typeof cell === 'object' && cell !== null && cell.kind === 'formula'

/** Chuyển ô sang dạng cell object của SheetJS (tách riêng để test được không cần thư viện). */
export function toSheetCell(cell: XlsxCell): {
  t: 's' | 'n' | 'z'
  v?: string | number
  f?: string
} {
  if (cell === null) return { t: 'z' }
  if (isFormula(cell)) return { t: 'n', f: cell.f }
  if (typeof cell === 'number') return Number.isFinite(cell) ? { t: 'n', v: cell } : { t: 'z' }
  return { t: 's', v: cell }
}

/** Số thứ tự cột (0-based) → chữ cái cột Excel: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

export async function downloadXlsx(filename: string, sheets: readonly XlsxSheet[]): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows.map((row) => row.map(toSheetCell)))
    if (sheet.columnWidths) worksheet['!cols'] = sheet.columnWidths.map((wch) => ({ wch }))
    if (sheet.merges) worksheet['!merges'] = sheet.merges.map((ref) => XLSX.utils.decode_range(ref))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  }
  XLSX.writeFile(workbook, filename)
}
