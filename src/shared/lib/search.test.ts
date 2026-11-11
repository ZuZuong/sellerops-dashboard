import { describe, expect, it } from 'vitest'
import { toSearchTerm } from './search'

describe('toSearchTerm', () => {
  it('giữ nguyên từ khóa thường, kể cả tiếng Việt', () => {
    expect(toSearchTerm('Áo thun')).toBe('Áo thun')
  })

  it('loại ký tự đặc biệt của PostgREST và wildcard LIKE', () => {
    expect(toSearchTerm('a,b)(c')).toBe('a b c')
    expect(toSearchTerm('100%_off*')).toBe('100 off')
    expect(toSearchTerm('"x"\\y')).toBe('x y')
  })

  it('chuỗi chỉ có ký tự đặc biệt → rỗng', () => {
    expect(toSearchTerm(' %%, ')).toBe('')
  })
})
