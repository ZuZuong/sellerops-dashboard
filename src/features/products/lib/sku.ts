export const SKU_PREFIX = 'DN'

/**
 * Phần tên trong SKU: viết liền, không dấu, in hoa. "Áo thun Đỏ #1" → "AOTHUNDO1".
 * Chỉ dùng để XEM TRƯỚC trên form — SKU thật do DB sinh (`public.sku_name_part`), hai bên
 * cùng quy tắc: bỏ dấu, chỉ giữ A-Z 0-9, rỗng thì dùng "SP".
 */
export function toSkuNamePart(name: string): string {
  const part = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
  return part || 'SP'
}

/** Mẫu SKU sẽ được tạo, STT do DB cấp khi lưu: "DN-AOTHUNBASIC-###". */
export function previewSku(name: string): string {
  return `${SKU_PREFIX}-${toSkuNamePart(name)}-###`
}
