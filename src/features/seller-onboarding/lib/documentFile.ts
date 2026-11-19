import { sanitizeFileName } from '@/shared/lib/fileName'
import type { Enums } from '@/shared/types/database.types'

export type DocumentKind = Enums<'seller_document_kind'>

/** Khớp cấu hình bucket `seller-documents` (giới hạn dung lượng + loại file) trong migration. */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const DOCUMENT_ACCEPT = DOCUMENT_MIME_TYPES.join(',')

const EXTENSION_MIME: Readonly<Record<string, (typeof DOCUMENT_MIME_TYPES)[number]>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export const DOCUMENT_KIND_META: Readonly<
  Record<DocumentKind, { label: string; required: boolean; hint: string }>
> = {
  business_license: {
    label: 'Giấy phép kinh doanh',
    required: true,
    hint: 'Giấy chứng nhận đăng ký kinh doanh / đăng ký hộ kinh doanh, bản chụp rõ nét.',
  },
  representative_id: {
    label: 'Giấy tờ người đại diện',
    required: false,
    hint: 'CCCD / hộ chiếu của người đại diện (không bắt buộc).',
  },
}

/**
 * MIME thật của file theo đuôi khi trình duyệt báo rỗng / chung chung. Trả về null nếu không
 * thuộc loại được nhận.
 */
export function documentMimeType(file: Pick<File, 'name' | 'type'>): string | null {
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return file.type === '' || file.type === 'application/octet-stream'
    ? (EXTENSION_MIME[extension] ?? null)
    : null
}

/**
 * Kiểm tra file trước khi tải lên. Bucket cũng giới hạn y hệt ở server — kiểm tra ở client để báo
 * lỗi ngay, không tốn băng thông.
 */
export function validateDocumentFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!documentMimeType(file)) return 'Chỉ nhận file PDF, JPG hoặc PNG.'
  if (file.size === 0) return 'File rỗng, vui lòng chọn file khác.'
  if (file.size > DOCUMENT_MAX_BYTES) return 'File vượt quá 5 MB.'
  return null
}

/** `{owner_id}/{kind}/{timestamp}-{tên-đã-làm-sạch}` — RLS Storage chỉ cho ghi vào thư mục của mình. */
export function buildDocumentPath(
  ownerId: string,
  kind: DocumentKind,
  fileName: string,
  now: number = Date.now(),
): string {
  return `${ownerId}/${kind}/${now}-${sanitizeFileName(fileName)}`
}
