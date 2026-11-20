import { describe, expect, it } from 'vitest'
import {
  businessInfoSchema,
  canConfirmTerms,
  categoriesStepSchema,
  documentsStepSchema,
} from '@/features/seller-onboarding/schemas/application.schema'

const valid = {
  shop_name: ' Thời trang An Nhiên ',
  business_type: 'household',
  business_name: 'Hộ kinh doanh An Nhiên',
  tax_code: '0312345678',
  license_number: '41M8012345',
  address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
  representative_name: 'Nguyễn Văn A',
  representative_phone: '0912 345 678',
  contact_email: 'shop@example.com',
  main_category: 'Thời trang & phụ kiện',
}

const errorsOf = (input: Record<string, unknown>) => {
  const result = businessInfoSchema.safeParse({ ...valid, ...input })
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}

describe('businessInfoSchema (bước 1)', () => {
  it('hợp lệ: cắt khoảng trắng, chuẩn hóa số điện thoại', () => {
    const parsed = businessInfoSchema.parse(valid)
    expect(parsed.shop_name).toBe('Thời trang An Nhiên')
    expect(parsed.representative_phone).toBe('0912345678')
  })

  it('mã số thuế: 10 số hoặc 10 số + "-" + 3 số (khớp CHECK của bảng sellers)', () => {
    expect(errorsOf({ tax_code: '0312345678-001' })).toEqual({})
    expect(errorsOf({ tax_code: '031234567' }).tax_code).toMatch(/10 chữ số/)
    expect(errorsOf({ tax_code: '03123456ab' }).tax_code).toMatch(/10 chữ số/)
  })

  it('số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx', () => {
    expect(errorsOf({ representative_phone: '+84912345678' })).toEqual({})
    expect(errorsOf({ representative_phone: '12345' }).representative_phone).toMatch(/không hợp lệ/)
  })

  it('bắt buộc đủ thông tin, loại hình trong danh sách', () => {
    expect(errorsOf({ shop_name: '' }).shop_name).toBe('Vui lòng nhập tên shop')
    expect(errorsOf({ business_type: 'hop-tac-xa' }).business_type).toBe(
      'Vui lòng chọn loại hình kinh doanh',
    )
    expect(errorsOf({ contact_email: 'abc' }).contact_email).toBe('Email không hợp lệ')
    expect(errorsOf({ address: 'Q1' }).address).toMatch(/tối thiểu 5 ký tự/)
  })
})

describe('schema các bước còn lại', () => {
  it('bước 2: bắt buộc có giấy phép kinh doanh', () => {
    expect(documentsStepSchema.safeParse({ businessLicenseCount: 0 }).success).toBe(false)
    expect(documentsStepSchema.safeParse({ businessLicenseCount: 1 }).success).toBe(true)
  })

  it('bước 3: tối thiểu 1 danh mục', () => {
    expect(categoriesStepSchema.safeParse(0).success).toBe(false)
    expect(categoriesStepSchema.safeParse(1).success).toBe(true)
  })

  it('bước 4: chỉ xác nhận được khi đã cuộn hết VÀ tick đồng ý', () => {
    expect(canConfirmTerms({ scrolledToEnd: false, accepted: false })).toBe(false)
    expect(canConfirmTerms({ scrolledToEnd: true, accepted: false })).toBe(false)
    expect(canConfirmTerms({ scrolledToEnd: false, accepted: true })).toBe(false)
    expect(canConfirmTerms({ scrolledToEnd: true, accepted: true })).toBe(true)
  })
})
