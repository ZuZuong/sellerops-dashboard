import { describe, expect, it } from 'vitest'
import {
  buildDocumentPath,
  documentMimeType,
  DOCUMENT_MAX_BYTES,
  validateDocumentFile,
} from './documentFile'
import { sanitizeFileName } from '@/shared/lib/fileName'

const file = (name: string, type: string, size = 1024) => ({ name, type, size })

describe('validateDocumentFile', () => {
  it('nhận PDF, JPG, PNG tối đa 5 MB', () => {
    expect(validateDocumentFile(file('gp.pdf', 'application/pdf'))).toBeNull()
    expect(validateDocumentFile(file('a.jpg', 'image/jpeg'))).toBeNull()
    expect(validateDocumentFile(file('a.png', 'image/png', DOCUMENT_MAX_BYTES))).toBeNull()
  })

  it('từ chối loại file khác', () => {
    expect(validateDocumentFile(file('a.docx', 'application/msword'))).toBe(
      'Chỉ nhận file PDF, JPG hoặc PNG.',
    )
    expect(validateDocumentFile(file('a.webp', 'image/webp'))).toBe(
      'Chỉ nhận file PDF, JPG hoặc PNG.',
    )
  })

  it('từ chối file vượt 5 MB hoặc rỗng', () => {
    expect(validateDocumentFile(file('a.pdf', 'application/pdf', DOCUMENT_MAX_BYTES + 1))).toBe(
      'File vượt quá 5 MB.',
    )
    expect(validateDocumentFile(file('a.pdf', 'application/pdf', 0))).toBe(
      'File rỗng, vui lòng chọn file khác.',
    )
  })

  it('trình duyệt không báo MIME → đoán theo đuôi, nhưng không tin đuôi khi MIME đã sai', () => {
    expect(documentMimeType(file('scan.PDF', ''))).toBe('application/pdf')
    expect(documentMimeType(file('anh.jpeg', 'application/octet-stream'))).toBe('image/jpeg')
    expect(documentMimeType(file('virus.pdf', 'application/x-msdownload'))).toBeNull()
  })
})

describe('sanitizeFileName / buildDocumentPath', () => {
  it('bỏ dấu, ký tự đặc biệt, giữ đuôi', () => {
    expect(sanitizeFileName('Giấy phép KD (bản 2).PDF')).toBe('giay-phep-kd-ban-2.pdf')
    expect(sanitizeFileName('Đơn đăng ký.png')).toBe('don-dang-ky.png')
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('C:\\fakepath\\GPKD.pdf')).toBe('gpkd.pdf')
    expect(sanitizeFileName('###.jpg')).toBe('tai-lieu.jpg')
  })

  it('đường dẫn {owner_id}/{kind}/{timestamp}-{tên} khớp CHECK của bảng seller_documents', () => {
    const owner = '3f2b1c4d-1111-4222-8333-444455556666'
    const path = buildDocumentPath(owner, 'business_license', 'GP KD.pdf', 1700000000000)
    expect(path).toBe(`${owner}/business_license/1700000000000-gp-kd.pdf`)
    expect(path).toMatch(/^[0-9a-f-]{36}\/(business_license|representative_id)\/[^/]+$/)
  })
})
