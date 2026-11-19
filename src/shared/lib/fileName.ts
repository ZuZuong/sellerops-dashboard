/**
 * Tên file an toàn cho đường dẫn Storage: bỏ dấu tiếng Việt, chỉ giữ chữ thường / số / `.-_`,
 * tối đa 80 ký tự, giữ đuôi file. "Giấy phép KD (bản 2).PDF" → "giay-phep-kd-ban-2.pdf".
 */
export function sanitizeFileName(name: string): string {
  // Chỉ lấy phần tên sau dấu / hoặc \ cuối cùng (không cho đường dẫn lọt vào key Storage).
  const leaf = name.split(/[\\/]/).pop() ?? ''
  const dot = leaf.lastIndexOf('.')
  const base = dot > 0 ? leaf.slice(0, dot) : leaf
  const extension =
    dot > 0
      ? leaf
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : ''
  const clean = base
    .normalize('NFD')
    // Dấu thanh / dấu mũ tiếng Việt sau khi tách NFD (U+0300–U+036F).
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  const safeBase = clean || 'tai-lieu'
  return extension ? `${safeBase}.${extension}` : safeBase
}
