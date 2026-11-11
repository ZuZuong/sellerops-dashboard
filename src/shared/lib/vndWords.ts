/**
 * Đọc số tiền VND bằng chữ cho chứng từ (phiếu nhập kho, hóa đơn):
 * 1_250_000 → "Một triệu hai trăm năm mươi nghìn đồng".
 * Theo cách đọc phổ biến trên chứng từ kế toán: "lẻ" cho hàng chục 0, "mốt" / "tư" / "lăm".
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const SCALES = ['', 'nghìn', 'triệu', 'tỷ']

/** Đọc một nhóm 3 chữ số. `full` = phải đọc đủ hàng trăm (nhóm không đứng đầu). */
function readTriple(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100)
  const tens = Math.floor((value % 100) / 10)
  const ones = value % 10
  const words: string[] = []

  if (hundreds > 0 || full) words.push(DIGITS[hundreds] ?? '', 'trăm')

  if (tens > 1) {
    words.push(DIGITS[tens] ?? '', 'mươi')
    if (ones === 1) words.push('mốt')
    else if (ones === 4) words.push('tư')
    else if (ones === 5) words.push('lăm')
    else if (ones > 0) words.push(DIGITS[ones] ?? '')
  } else if (tens === 1) {
    words.push('mười')
    if (ones === 5) words.push('lăm')
    else if (ones > 0) words.push(DIGITS[ones] ?? '')
  } else if (ones > 0) {
    if (hundreds > 0 || full) words.push('lẻ')
    words.push(DIGITS[ones] ?? '')
  }

  return words.join(' ')
}

/** Đọc số nguyên không âm bằng chữ (không kèm "đồng"). */
export function numberToVietnameseWords(input: number): string {
  const value = Math.round(Math.abs(input))
  if (value === 0) return 'không'

  // Tách nhóm 3 chữ số từ phải sang; quá "tỷ" thì lặp lại thang (nghìn tỷ, triệu tỷ...).
  const groups: number[] = []
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000)

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i] ?? 0
    if (group === 0) {
      // Nhóm "tỷ" rỗng vẫn phải đọc thang "tỷ" khi còn nhóm lớn hơn (vd. 1.000.000.000.000).
      if (i % 3 === 0 && i > 0 && parts.length > 0) parts.push('tỷ')
      continue
    }
    const isFirst = parts.length === 0
    parts.push(readTriple(group, !isFirst))
    const scale = i % 3 === 0 && i > 0 ? 'tỷ' : (SCALES[i % 3] ?? '')
    if (scale) parts.push(scale)
  }

  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/(tỷ)( tỷ)+/g, '$1')
    .trim()
}

/** "Một triệu hai trăm năm mươi nghìn đồng" (viết hoa chữ đầu, dùng trên chứng từ). */
export function vndToWords(value: number): string {
  const words = numberToVietnameseWords(value)
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng`
}
