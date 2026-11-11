import { describe, expect, it } from 'vitest'
import { CSV_BOM, escapeCsvCell, toCsv } from './csv'

describe('escapeCsvCell', () => {
  it('giữ nguyên chữ có dấu và số', () => {
    expect(escapeCsvCell('Áo thun đỏ')).toBe('Áo thun đỏ')
    expect(escapeCsvCell(150000)).toBe('150000')
    expect(escapeCsvCell(-5)).toBe('-5')
  })

  it('bọc nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng', () => {
    expect(escapeCsvCell('Quần, áo')).toBe('"Quần, áo"')
    expect(escapeCsvCell('Size "L"')).toBe('"Size ""L"""')
    expect(escapeCsvCell('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"')
  })

  it('chặn công thức Excel trong chuỗi (CSV injection)', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(escapeCsvCell('+84901234567')).toBe("'+84901234567")
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('null / undefined / NaN thành ô trống', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
    expect(escapeCsvCell(Number.NaN)).toBe('')
  })
})

describe('toCsv', () => {
  it('có BOM UTF-8, header và dòng CRLF', () => {
    const csv = toCsv(
      [
        { name: 'Áo thun', qty: 3 },
        { name: 'Quần, jean', qty: 1 },
      ],
      [
        { header: 'Sản phẩm', value: (r) => r.name },
        { header: 'Số lượng', value: (r) => r.qty },
      ],
    )
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toBe(`${CSV_BOM}Sản phẩm,Số lượng\r\nÁo thun,3\r\n"Quần, jean",1\r\n`)
  })

  it('không có dòng dữ liệu → chỉ header', () => {
    expect(toCsv([], [{ header: 'A', value: () => 1 }])).toBe(`${CSV_BOM}A\r\n`)
  })
})
