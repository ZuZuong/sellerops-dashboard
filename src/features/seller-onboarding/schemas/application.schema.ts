import { z } from 'zod'
import type { Enums } from '@/shared/types/database.types'

export type BusinessType = Enums<'business_type'>

export const BUSINESS_TYPE_OPTIONS: ReadonlyArray<{ value: BusinessType; label: string }> = [
  { value: 'household', label: 'Hộ kinh doanh' },
  { value: 'company', label: 'Công ty' },
  { value: 'individual', label: 'Cá nhân kinh doanh' },
]

/** Ngành hàng chính của shop (thông tin hồ sơ — KHÔNG phải danh mục sản phẩm). */
export const MAIN_CATEGORY_OPTIONS = [
  'Thời trang & phụ kiện',
  'Mỹ phẩm & chăm sóc cá nhân',
  'Điện thoại & điện tử',
  'Nhà cửa & đời sống',
  'Mẹ & bé',
  'Thực phẩm & đồ uống',
  'Sách & văn phòng phẩm',
  'Thể thao & dã ngoại',
  'Khác',
] as const

/** Bỏ khoảng trắng, dấu chấm, gạch nối người dùng hay gõ trong số điện thoại. */
const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '')

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `Vui lòng nhập ${label}` })
    .trim()
    .min(1, `Vui lòng nhập ${label}`)
    .min(min, `${label[0]?.toUpperCase()}${label.slice(1)} tối thiểu ${min} ký tự`)
    .max(max, `${label[0]?.toUpperCase()}${label.slice(1)} tối đa ${max} ký tự`)

/**
 * Bước 1 — thông tin doanh nghiệp. Ràng buộc khớp CHECK của bảng `sellers` (MST, SĐT, email…)
 * để lỗi được báo ngay trên form thay vì bị database từ chối.
 */
export const businessInfoSchema = z.object({
  shop_name: text('tên shop', 2, 100),
  business_type: z.enum(['household', 'company', 'individual'], {
    error: 'Vui lòng chọn loại hình kinh doanh',
  }),
  business_name: text('tên doanh nghiệp / hộ kinh doanh', 2, 200),
  tax_code: z
    .string({ error: 'Vui lòng nhập mã số thuế' })
    .trim()
    .min(1, 'Vui lòng nhập mã số thuế')
    .regex(/^\d{10}(-\d{3})?$/, 'Mã số thuế gồm 10 chữ số (chi nhánh: 10 số + "-" + 3 số)'),
  license_number: text('số giấy phép kinh doanh', 1, 50),
  address: text('địa chỉ', 5, 500),
  representative_name: text('họ tên người đại diện', 2, 200),
  representative_phone: z
    .string({ error: 'Vui lòng nhập số điện thoại' })
    .transform(normalizePhone)
    .pipe(
      z
        .string()
        .min(1, 'Vui lòng nhập số điện thoại')
        .regex(/^(\+84|0)\d{9}$/, 'Số điện thoại không hợp lệ (vd. 0912345678)'),
    ),
  contact_email: z
    .string({ error: 'Vui lòng nhập email liên hệ' })
    .trim()
    .min(1, 'Vui lòng nhập email liên hệ')
    .max(254, 'Email quá dài')
    .pipe(z.email('Email không hợp lệ')),
  main_category: z
    .string({ error: 'Vui lòng chọn ngành hàng chính' })
    .trim()
    .min(1, 'Vui lòng chọn ngành hàng chính')
    .max(100, 'Ngành hàng tối đa 100 ký tự'),
})

export type BusinessInfoInput = z.input<typeof businessInfoSchema>
export type BusinessInfoValues = z.output<typeof businessInfoSchema>

/** Bước 3 — tối thiểu 1 danh mục của chính shop. */
export const categoriesStepSchema = z
  .number()
  .int()
  .min(1, 'Hãy tạo ít nhất 1 danh mục sản phẩm cho shop.')

/** Bước 2 — bắt buộc có giấy phép kinh doanh. */
export const documentsStepSchema = z.object({
  businessLicenseCount: z.number().int().min(1, 'Vui lòng tải lên giấy phép kinh doanh.'),
})

/** Bước 4 — đã đọc hết văn bản và tick đồng ý. */
export const termsStepSchema = z.object({
  scrolledToEnd: z.literal(true, { error: 'Vui lòng đọc hết văn bản cam kết.' }),
  accepted: z.literal(true, { error: 'Vui lòng tick đồng ý tuân thủ cam kết và nội quy.' }),
})

export type TermsStepState = { scrolledToEnd: boolean; accepted: boolean }

export function canConfirmTerms(state: TermsStepState): boolean {
  return termsStepSchema.safeParse(state).success
}
