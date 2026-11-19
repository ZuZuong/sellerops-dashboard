/** Chuẩn hóa để so khớp không phân biệt hoa thường / dấu tiếng Việt ("Duyệt" ~ "duyet"). */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
