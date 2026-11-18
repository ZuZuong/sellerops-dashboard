import { describe, expect, it } from 'vitest'
import { columnLetter, formula, toSheetCell } from './xlsxExport'

describe('xlsxExport', () => {
  it('columnLetter: 0 → A, 25 → Z, 26 → AA, 701 → ZZ', () => {
    expect([0, 11, 25, 26, 27, 701].map(columnLetter)).toEqual(['A', 'L', 'Z', 'AA', 'AB', 'ZZ'])
  })

  it('chuỗi giống công thức vẫn ghi là văn bản (chống chèn công thức từ dữ liệu người dùng)', () => {
    expect(toSheetCell('=SUM(A1:A9)')).toEqual({ t: 's', v: '=SUM(A1:A9)' })
  })

  it('công thức chỉ tạo qua formula(); số không hữu hạn và null → ô trống', () => {
    expect(toSheetCell(formula('H5*E5'))).toEqual({ t: 'n', f: 'H5*E5' })
    expect(toSheetCell(1500)).toEqual({ t: 'n', v: 1500 })
    expect(toSheetCell(Number.NaN)).toEqual({ t: 'z' })
    expect(toSheetCell(null)).toEqual({ t: 'z' })
  })
})
