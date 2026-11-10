/**
 * Chuẩn hóa từ khóa tìm kiếm trước khi ghép vào filter `or=(name.ilike...,sku.ilike...)` của PostgREST.
 * Loại bỏ ký tự có nghĩa đặc biệt trong cú pháp PostgREST (`,` `(` `)` `"` `\`) và wildcard
 * LIKE (`%` `_` `*`) để người dùng không vô tình (hoặc cố ý) thay đổi câu truy vấn.
 */
export function toSearchTerm(raw: string): string {
  return raw
    .replace(/[%_*,()"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
