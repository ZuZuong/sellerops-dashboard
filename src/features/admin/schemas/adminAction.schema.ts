import { z } from 'zod'

export const REASON_MAX = 1000

/** Lý do bắt buộc (từ chối hồ sơ, khóa, xóa): khớp `require_reason` trong DB. */
export const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập lý do')
    .max(REASON_MAX, `Lý do tối đa ${REASON_MAX} ký tự`),
})
export type ReasonValues = z.infer<typeof reasonSchema>

/** Ghi chú tùy chọn (duyệt hồ sơ, mở khóa, khôi phục tài khoản). */
export const noteSchema = z.object({
  reason: z.string().trim().max(REASON_MAX, `Ghi chú tối đa ${REASON_MAX} ký tự`),
})

// -----------------------------------------------------------------------------
// Bằng chứng vi phạm (bucket riêng tư `violation-evidence`, giới hạn khớp migration)
// -----------------------------------------------------------------------------
export const EVIDENCE_MAX_FILES = 10
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024
export const EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export function validateEvidenceFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(EVIDENCE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Chỉ nhận ảnh (JPG, PNG, WEBP) hoặc PDF.'
  }
  if (file.size === 0) return 'File rỗng.'
  if (file.size > EVIDENCE_MAX_BYTES) return 'File vượt quá 10 MB.'
  return null
}

/** Xóa tài khoản: lý do bắt buộc + tối đa 10 file bằng chứng (không bắt buộc). */
export const deleteAccountSchema = reasonSchema.extend({
  evidence: z
    .array(z.custom<File>((value) => value instanceof File))
    .max(EVIDENCE_MAX_FILES, `Tối đa ${EVIDENCE_MAX_FILES} file bằng chứng`)
    .superRefine((files, ctx) => {
      files.forEach((file) => {
        const error = validateEvidenceFile(file)
        if (error) ctx.addIssue({ code: 'custom', message: `${file.name}: ${error}` })
      })
    }),
})
export type DeleteAccountValues = z.infer<typeof deleteAccountSchema>
