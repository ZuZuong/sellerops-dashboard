import { describe, expect, it } from 'vitest'
import { numberToVietnameseWords, vndToWords } from './vndWords'

describe('numberToVietnameseWords', () => {
  it.each([
    [0, 'không'],
    [5, 'năm'],
    [10, 'mười'],
    [15, 'mười lăm'],
    [21, 'hai mươi mốt'],
    [24, 'hai mươi tư'],
    [55, 'năm mươi lăm'],
    [105, 'một trăm lẻ năm'],
    [110, 'một trăm mười'],
    [1_005, 'một nghìn không trăm lẻ năm'],
    [12_000, 'mười hai nghìn'],
    [150_000, 'một trăm năm mươi nghìn'],
    [1_250_000, 'một triệu hai trăm năm mươi nghìn'],
    [2_000_500, 'hai triệu năm trăm'],
    [1_000_000_000, 'một tỷ'],
    [3_050_000_000, 'ba tỷ không trăm năm mươi triệu'],
  ])('%i → %s', (value, words) => {
    expect(numberToVietnameseWords(value)).toBe(words)
  })

  it('làm tròn số thập phân', () => {
    expect(numberToVietnameseWords(99.6)).toBe('một trăm')
  })
})

describe('vndToWords', () => {
  it('viết hoa chữ đầu, kèm "đồng"', () => {
    expect(vndToWords(1_250_000)).toBe('Một triệu hai trăm năm mươi nghìn đồng')
    expect(vndToWords(0)).toBe('Không đồng')
  })
})
