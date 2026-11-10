import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseProductImport } from './importProducts'
import { readSpreadsheet } from './spreadsheet'

/** Tạo file .xlsx thật trong bộ nhớ, bắt đầu từ ô `origin`. */
function makeXlsx(rows: unknown[][], origin = 'A1'): File {
  const sheet = XLSX.utils.aoa_to_sheet([])
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sản phẩm')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buffer], 'san-pham.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('readSpreadsheet (SheetJS)', () => {
  it('đọc file .xlsx thật và nhập được sản phẩm tiếng Việt', async () => {
    const file = makeXlsx([
      ['Tên sản phẩm *', 'Danh mục *', 'Giá bán *'],
      ['Áo sơ mi trắng', 'Áo sơ mi', 320000],
    ])
    const result = parseProductImport(await readSpreadsheet(file))
    expect(result).toMatchObject({
      ok: true,
      products: [{ name: 'Áo sơ mi trắng', category: 'Áo sơ mi', price: 320000, rowNumber: 2 }],
    })
  })

  it('giữ đúng số dòng Excel khi dữ liệu không bắt đầu từ A1 và có dòng trống', async () => {
    const file = makeXlsx(
      [['Tên', 'Danh mục', 'Giá'], ['Đầm maxi', 'Đầm', 500000], [], [null, 'Đầm', 1]],
      'B3',
    )
    const result = parseProductImport(await readSpreadsheet(file))
    // Tiêu đề ở dòng 3 → dòng lỗi (thiếu tên) là dòng 6 như người dùng thấy trong Excel.
    expect(result).toEqual({ ok: false, errors: ['Dòng 6: thiếu Tên sản phẩm.'] })
  })
})
