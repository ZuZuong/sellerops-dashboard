import { getDbErrorInfo, getErrorMessage } from '@/shared/lib/errors'

const APPLICATION_FIELD_LABELS: Readonly<Record<string, string>> = {
  shop_name: 'tên shop',
  business_type: 'loại hình',
  business_name: 'tên doanh nghiệp',
  tax_code: 'mã số thuế',
  license_number: 'số giấy phép',
  address: 'địa chỉ',
  representative_name: 'người đại diện',
  representative_phone: 'SĐT người đại diện',
  contact_email: 'email liên hệ',
  main_category: 'ngành hàng chính',
}

const ONBOARDING_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  APPLICATION_NOT_EDITABLE: 'Hồ sơ đã gửi hoặc đã được duyệt nên không sửa được nữa.',
  BUSINESS_LICENSE_REQUIRED: 'Vui lòng tải lên giấy phép kinh doanh (bước 2).',
  CATEGORY_REQUIRED: 'Hãy tạo ít nhất 1 danh mục sản phẩm (bước 3).',
  TERMS_NOT_ACCEPTED: 'Vui lòng xác nhận cam kết và nội quy.',
  INVALID_BUSINESS_TYPE: 'Loại hình kinh doanh không hợp lệ.',
  INVALID_APPLICATION_DATA: 'Dữ liệu hồ sơ không hợp lệ.',
  DOCUMENT_UPLOAD_FAILED:
    'Không tải được file lên. Kiểm tra mạng, định dạng (PDF, JPG, PNG) và dung lượng (tối đa 5 MB).',
  DOCUMENT_INVALID: 'Chỉ nhận file PDF, JPG hoặc PNG, tối đa 5 MB.',
}

/** Chuyển lỗi lưu / gửi hồ sơ, tải giấy tờ thành thông báo tiếng Việt. */
export function getOnboardingErrorMessage(error: unknown): string {
  const { code, message, details } = getDbErrorInfo(error)
  if (message === 'APPLICATION_INCOMPLETE') {
    const missing = (details ?? '')
      .split(',')
      .map((field) => APPLICATION_FIELD_LABELS[field.trim()])
      .filter(Boolean)
    return missing.length > 0
      ? `Hồ sơ còn thiếu: ${missing.join(', ')} (bước 1).`
      : 'Hồ sơ chưa đủ thông tin (bước 1).'
  }
  if (message && ONBOARDING_ERROR_MESSAGES[message]) return ONBOARDING_ERROR_MESSAGES[message]
  // CHECK constraint của bảng sellers (MST, SĐT, email sai định dạng…).
  if (code === '23514') return 'Thông tin hồ sơ không đúng định dạng. Vui lòng kiểm tra lại bước 1.'
  return getErrorMessage(error)
}
