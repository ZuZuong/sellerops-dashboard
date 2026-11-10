import { formatNumber } from '@/shared/lib/formatters'

export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** Khớp `file_size_limit` của bucket `product-images`. */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
/** Khớp CHECK `cardinality(image_paths) <= 8`. */
export const MAX_GALLERY_IMAGES = 8

/**
 * Một ảnh trong form: hoặc ảnh đã lưu (`path`), hoặc file mới chọn chưa tải lên (`file`).
 * `previewUrl` là URL public (ảnh đã lưu) hoặc object URL (file mới) để hiển thị.
 */
export interface ProductImage {
  key: string
  path: string | null
  file: File | null
  previewUrl: string
}

export interface ProductMedia {
  hero: ProductImage | null
  gallery: ProductImage[]
}

export const EMPTY_MEDIA: ProductMedia = { hero: null, gallery: [] }

/** Lỗi tiếng Việt nếu file không hợp lệ, `null` nếu hợp lệ. */
export function validateImageFile(file: File): string | null {
  if (!(PRODUCT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" không phải ảnh JPG, PNG hoặc WEBP.`
  }
  if (file.size > MAX_IMAGE_SIZE) {
    const mb = formatNumber(MAX_IMAGE_SIZE / 1024 / 1024)
    return `"${file.name}" vượt quá ${mb} MB.`
  }
  return null
}

/** Lấy các file ảnh từ clipboard (Ctrl+V ảnh chụp màn hình / ảnh copy từ web). */
export function getClipboardImageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'))
}

/** Đuôi file lưu trên Storage, suy từ MIME type (tên file người dùng có thể thiếu / sai đuôi). */
export function imageExtension(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'jpg'
  }
}

/** Đường dẫn ảnh đang được dùng sau khi lưu (theo thứ tự: ảnh đại diện, ảnh phụ). */
export function mediaPaths(media: ProductMedia): string[] {
  return [media.hero, ...media.gallery]
    .map((image) => image?.path ?? null)
    .filter((path): path is string => path !== null)
}
