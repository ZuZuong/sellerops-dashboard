import { describe, expect, it } from 'vitest'
import { formatCurrency } from '@/shared/lib/formatters'
import {
  IMPORT_COLUMNS,
  matchCategory,
  matchUnit,
  MAX_IMPORT_ROWS,
  normalizeHeader,
  parseIntegerCell,
  parseProductImport,
} from './importProducts'

/** Đúng dòng tiêu đề của file mẫu. */
const HEADER = IMPORT_COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label))

const expectErrors = (rows: unknown[][]) => {
  const result = parseProductImport(rows)
  if (result.ok) throw new Error('expected errors')
  return result.errors
}

describe('normalizeHeader / matchCategory / matchUnit', () => {
  it('bỏ dấu, chữ thường, bỏ * và phần trong ngoặc', () => {
    expect(normalizeHeader('Giá bán *')).toBe('gia ban')
    expect(normalizeHeader('  GIÁ BÁN (VNĐ) ')).toBe('gia ban')
    expect(normalizeHeader('Đơn giá')).toBe('don gia')
  })

  it('so khớp danh mục không phân biệt hoa thường / dấu', () => {
    expect(matchCategory('ao thun')).toBe('Áo thun')
    expect(matchCategory(' QUẦN JEAN ')).toBe('Quần jean')
    expect(matchCategory('Điện thoại')).toBeNull()
  })

  it('so khớp đơn vị tính', () => {
    expect(matchUnit('cai')).toBe('Cái')
    expect(matchUnit('ĐÔI')).toBe('Đôi')
    expect(matchUnit('thùng')).toBeNull()
  })
})

describe('parseIntegerCell', () => {
  it.each([
    [150000, 150000],
    ['150000', 150000],
    ['150.000', 150000],
    ['1,250,000', 1250000],
    ['150.000 ₫', 150000],
    ['150000đ', 150000],
    ['99 VND', 99],
  ])('%j → %j', (input, expected) => {
    expect(parseIntegerCell(input)).toBe(expected)
  })

  it('ô trống → undefined; không phải số → null', () => {
    expect(parseIntegerCell(null)).toBeUndefined()
    expect(parseIntegerCell('  ')).toBeUndefined()
    expect(parseIntegerCell('abc')).toBeNull()
    expect(parseIntegerCell('1.5')).toBeNull()
    expect(parseIntegerCell('-5')).toBeNull()
  })
})

describe('parseProductImport', () => {
  it('file mẫu hợp lệ → sản phẩm đã chuẩn hóa (ĐVT, giá vốn, tồn đầu kỳ), giữ số dòng', () => {
    const result = parseProductImport([
      HEADER,
      ['Áo thun basic', 'áo thun', 'cai', '90.000', '150.000', 20, null, 'Cotton 100%'],
      [null, null, null, null, null, null, null, null], // dòng trống bị bỏ qua
      ['Giày sneaker', 'Giày dép', 'Đôi', 320000, 550000, null, 3, null],
    ])

    expect(result).toEqual({
      ok: true,
      warnings: [],
      products: [
        {
          rowNumber: 2,
          name: 'Áo thun basic',
          category: 'Áo thun',
          unit: 'Cái',
          cost_price: 90000,
          price: 150000,
          stock: 20,
          low_stock_threshold: 5,
          description: 'Cotton 100%',
        },
        {
          rowNumber: 4,
          name: 'Giày sneaker',
          category: 'Giày dép',
          unit: 'Đôi',
          cost_price: 320000,
          price: 550000,
          stock: 0,
          low_stock_threshold: 3,
          description: null,
        },
      ],
    })
  })

  it('chấp nhận tên cột thường gặp (ĐVT, giá nhập), cột phụ và thứ tự bất kỳ', () => {
    const result = parseProductImport([
      ['Giá', 'Ảnh', 'Tên', 'ĐVT', 'Giá nhập', 'Nhóm hàng'],
      [100000, 'https://example.com/a.jpg', 'Mũ lưỡi trai', 'Cái', 60000, 'Phụ kiện'],
    ])
    expect(result.ok && result.products[0]).toMatchObject({
      name: 'Mũ lưỡi trai',
      category: 'Phụ kiện',
      unit: 'Cái',
      cost_price: 60000,
      price: 100000,
    })
  })

  it('báo thiếu cột bắt buộc', () => {
    expect(
      expectErrors([
        ['Tên sản phẩm', 'Tồn kho'],
        ['Áo', 1],
      ]),
    ).toEqual([
      'Thiếu cột "Danh mục".',
      'Thiếu cột "Đơn vị tính".',
      'Thiếu cột "Giá vốn".',
      'Thiếu cột "Giá bán".',
    ])
  })

  it('báo từng dòng thiếu / sai dữ liệu, kèm số dòng trong Excel', () => {
    const errors = expectErrors([
      [],
      HEADER, // tiêu đề ở dòng 2
      ['Áo thun', 'Áo thun', 'Cái', 90000, 150000],
      [null, 'Áo thun', 'Cái', null, null],
      ['Ốp lưng', 'Điện thoại', 'Thùng', 1, 'abc', -1],
      ['Váy', null, 'Cái', 100, 200000, 1.5],
    ])
    expect(errors).toEqual([
      'Dòng 4: thiếu Tên sản phẩm; thiếu Giá vốn; thiếu Giá bán.',
      'Dòng 5: Danh mục "Điện thoại" không có trong danh sách; Đơn vị tính "Thùng" không có trong danh sách; Giá bán "abc" không phải số hợp lệ; Tồn kho không được âm.',
      'Dòng 6: thiếu Danh mục; Tồn kho phải là số nguyên.',
    ])
  })

  it('giá bán thấp hơn giá vốn: vẫn nhập được nhưng có cảnh báo', () => {
    const result = parseProductImport([HEADER, ['Áo xả kho', 'Áo thun', 'Cái', 120000, 99000]])
    expect(result.ok && result.warnings).toEqual([
      `Dòng 2: giá bán ${formatCurrency(99000)} thấp hơn giá vốn ${formatCurrency(120000)} (bán lỗ).`,
    ])
  })

  it('file trống / không có dòng dữ liệu', () => {
    expect(expectErrors([])).toEqual(['File trống, không có dòng tiêu đề.'])
    expect(expectErrors([HEADER, [null, '']])).toEqual([
      'File không có dòng sản phẩm nào bên dưới dòng tiêu đề.',
    ])
  })

  it(`giới hạn ${MAX_IMPORT_ROWS} dòng mỗi lần`, () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => [
      `SP ${i}`,
      'Đầm',
      'Cái',
      500,
      1000,
    ])
    expect(expectErrors([HEADER, ...rows])[0]).toMatch(/tối đa 500 dòng/)
  })
})
