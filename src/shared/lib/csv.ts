/**
 * Xuất CSV mở được bằng Excel với tiếng Việt có dấu:
 * - Thêm BOM UTF-8 (U+FEFF) ở đầu file — thiếu BOM, Excel trên Windows đọc theo ANSI và vỡ dấu.
 * - Xuống dòng CRLF theo RFC 4180.
 * - Ô có dấu phẩy, nháy kép hoặc xuống dòng được bọc nháy kép, nháy kép bên trong nhân đôi.
 * - Chuỗi bắt đầu bằng = + - @ (hoặc tab / CR) được thêm dấu nháy đơn để Excel không hiểu là công
 *   thức (chống CSV injection từ dữ liệu người dùng nhập, vd. tên sản phẩm).
 */

export const CSV_BOM = String.fromCharCode(0xfeff)

export type CsvValue = string | number | boolean | null | undefined

export interface CsvColumn<Row> {
  header: string
  value: (row: Row) => CsvValue
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  // Số giữ nguyên (kể cả số âm) để Excel vẫn tính toán được.
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  if (FORMULA_PREFIX.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [
    columns.map((column) => escapeCsvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(',')),
  ]
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}

/** Tải chuỗi CSV về máy người dùng dưới tên `filename`. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Trì hoãn thu hồi để trình duyệt kịp bắt đầu tải.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
