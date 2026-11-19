import { describe, expect, it } from 'vitest'
import { accountStateOf, auditActionLabel, auditReason } from '../domain/labels'
import {
  deleteAccountSchema,
  EVIDENCE_MAX_BYTES,
  reasonSchema,
  validateEvidenceFile,
} from '../schemas/adminAction.schema'
import {
  accountFiltersSchema,
  auditFiltersSchema,
  sellerDetailTabSchema,
  sellerFiltersSchema,
} from '../schemas/adminFilters.schema'
import { ADMIN_ERROR_MESSAGES, getAdminErrorMessage } from './adminErrors'
import { normalizeSearch } from './search'

describe('getAdminErrorMessage', () => {
  it.each([
    ['NOT_ADMIN', /không có quyền quản trị/],
    ['SELLER_NOT_PENDING', /không còn ở trạng thái chờ duyệt/],
    ['INVALID_SELLER_TRANSITION', /Không thể chuyển shop/],
    ['CANNOT_LOCK_ADMIN', /quản trị viên khác/],
    ['CANNOT_DELETE_SELF', /chính mình/],
    ['ACCOUNT_PENDING_DELETION', /khôi phục tài khoản trước/],
    ['INVALID_EVIDENCE', /bằng chứng không hợp lệ/],
  ])('map lỗi RPC %s sang tiếng Việt', (code, expected) => {
    expect(getAdminErrorMessage({ message: code, code: 'P0001' })).toMatch(expected)
  })

  it('lỗi từ Edge Function (Error với message là mã) cũng được map', () => {
    expect(getAdminErrorMessage(new Error('EMAIL_SEND_FAILED'))).toBe(
      ADMIN_ERROR_MESSAGES.EMAIL_SEND_FAILED,
    )
  })

  it('mã lạ → thông báo chung, không lộ thông điệp kỹ thuật', () => {
    expect(getAdminErrorMessage({ message: 'relation "x" does not exist' })).toBe(
      'Đã có lỗi xảy ra. Vui lòng thử lại.',
    )
  })
})

describe('schema hành động admin', () => {
  it('lý do bắt buộc, tối đa 1000 ký tự', () => {
    expect(reasonSchema.safeParse({ reason: '   ' }).success).toBe(false)
    expect(reasonSchema.safeParse({ reason: 'a'.repeat(1001) }).success).toBe(false)
    expect(reasonSchema.parse({ reason: '  Bán hàng giả  ' }).reason).toBe('Bán hàng giả')
  })

  it('bằng chứng: ảnh / PDF ≤ 10 MB, tối đa 10 file', () => {
    expect(validateEvidenceFile({ type: 'image/png', size: 100 })).toBeNull()
    expect(validateEvidenceFile({ type: 'application/pdf', size: EVIDENCE_MAX_BYTES })).toBeNull()
    expect(validateEvidenceFile({ type: 'video/mp4', size: 100 })).toMatch(/Chỉ nhận/)
    expect(validateEvidenceFile({ type: 'image/png', size: EVIDENCE_MAX_BYTES + 1 })).toMatch(
      /10 MB/,
    )

    const png = (name: string) => new File(['x'], name, { type: 'image/png' })
    expect(deleteAccountSchema.safeParse({ reason: 'x', evidence: [] }).success).toBe(true)
    expect(
      deleteAccountSchema.safeParse({
        reason: 'x',
        evidence: Array.from({ length: 11 }, (_, i) => png(`${i}.png`)),
      }).success,
    ).toBe(false)
    const bad = deleteAccountSchema.safeParse({
      reason: 'x',
      evidence: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })],
    })
    expect(bad.error?.issues[0]?.message).toMatch(/^clip\.mp4: Chỉ nhận/)
  })
})

describe('bộ lọc trên URL', () => {
  it('giá trị sửa tay sai → về mặc định từng trường', () => {
    expect(accountFiltersSchema.parse({ role: 'root', state: 'x', page: '-2' })).toMatchObject({
      role: 'all',
      state: 'all',
      page: 1,
    })
    expect(sellerFiltersSchema.parse({ status: 'suspended', pageSize: '50' })).toMatchObject({
      status: 'suspended',
      pageSize: 50,
    })
    expect(
      auditFiltersSchema.parse({ actor: 'abc', from: '2026-11-01', to: '01/11' }),
    ).toMatchObject({ actor: '', from: '2026-11-01', to: '' })
    expect(sellerDetailTabSchema.parse({ tab: 'secrets' }).tab).toBe('profile')
  })
})

describe('nhãn hiển thị', () => {
  it('trạng thái tài khoản: xóa > khóa > hoạt động', () => {
    expect(accountStateOf({ account_status: 'pending_deletion', is_locked: true }).label).toBe(
      'Chờ xác nhận xóa',
    )
    expect(accountStateOf({ account_status: 'active', is_locked: true }).label).toBe('Bị khóa')
    expect(accountStateOf({ account_status: 'active', is_locked: false }).label).toBe('Hoạt động')
  })

  it('hành động audit log và lý do trong metadata', () => {
    expect(auditActionLabel('account.deletion_requested')).toBe('Xóa tài khoản')
    expect(auditActionLabel('seller.unknown')).toBe('seller.unknown')
    expect(auditReason({ reason: 'Hàng giả' })).toBe('Hàng giả')
    expect(auditReason({ note: 'Khiếu nại hợp lệ' })).toBe('Khiếu nại hợp lệ')
    expect(auditReason({ from: 'pending' })).toBeNull()
  })

  it('tìm kiếm nhanh không phân biệt dấu', () => {
    expect(normalizeSearch('  Duyệt  Hồ sơ ')).toBe('duyet ho so')
    expect(normalizeSearch('Đơn')).toBe('don')
  })
})
