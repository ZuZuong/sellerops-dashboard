import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { IMPORT_COLUMNS, parseProductImport } from './importProducts'
import { buildGuideRows, readSpreadsheet, TEMPLATE_DATA_SHEET } from './spreadsheet'

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
      ['Tên sản phẩm *', 'Danh mục *', 'Đơn vị tính *', 'Giá vốn *', 'Giá bán *'],
      ['Áo sơ mi trắng', 'Áo sơ mi', 'Chiếc', 180000, 320000],
    ])
    const { sheetName, rows } = await readSpreadsheet(file)
    expect(sheetName).toBe('Sản phẩm')
    expect(parseProductImport(rows)).toMatchObject({
      ok: true,
      products: [
        {
          name: 'Áo sơ mi trắng',
          category: 'Áo sơ mi',
          unit: 'Chiếc',
          cost_price: 180000,
          price: 320000,
          rowNumber: 2,
        },
      ],
    })
  })

  it('giữ đúng số dòng Excel khi dữ liệu không bắt đầu từ A1 và có dòng trống', async () => {
    const file = makeXlsx(
      [
        ['Tên', 'Danh mục', 'ĐVT', 'Giá vốn', 'Giá'],
        ['Đầm maxi', 'Đầm', 'Cái', 300000, 500000],
        [],
        [null, 'Đầm', 'Cái', 1, 1],
      ],
      'B3',
    )
    const result = parseProductImport((await readSpreadsheet(file)).rows)
    // Tiêu đề ở dòng 3 → dòng lỗi (thiếu tên) là dòng 6 như người dùng thấy trong Excel.
    expect(result).toEqual({ ok: false, errors: ['Dòng 6: thiếu Tên sản phẩm.'] })
  })
})

describe('file mẫu', () => {
  it('sheet Hướng dẫn mô tả đủ các cột, nêu rõ cột bắt buộc', () => {
    const guide = buildGuideRows()
    const table = guide.slice(guide.findIndex((row) => row[0] === 'Cột') + 1)
    expect(table.map((row) => [row[0], row[1]])).toEqual([
      ['Tên sản phẩm', 'Có'],
      ['Danh mục', 'Có'],
      ['Đơn vị tính', 'Có'],
      ['Giá vốn', 'Có'],
      ['Giá bán', 'Có'],
      ['Tồn đầu kỳ', 'Không'],
      ['Ngưỡng cảnh báo', 'Không'],
      ['Mô tả', 'Không'],
    ])
    expect(guide.flat().join(' ')).toContain(`sheet "${TEMPLATE_DATA_SHEET}"`)
  })

  it('dòng ví dụ của file mẫu nhập được ngay (không lỗi)', () => {
    const header = IMPORT_COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label))
    const example = IMPORT_COLUMNS.map((c) => c.example)
    expect(parseProductImport([header, example])).toMatchObject({ ok: true, warnings: [] })
  })
})
