import { describe, expect, it } from 'vitest'
import { SELLER_STATUSES } from '@/features/sellers'
import { isScrolledToBottom } from '../lib/scroll'
import { resolveSellerGate, stepIndexFromCurrentStep } from './sellerGate'

describe('resolveSellerGate', () => {
  it('chỉ shop approved mới mở dashboard; mọi trạng thái khác có màn hình chặn riêng', () => {
    const gates = Object.fromEntries(SELLER_STATUSES.map((s) => [s, resolveSellerGate(s)]))
    expect(gates).toEqual({
      draft: 'draft',
      pending: 'pending',
      approved: 'open',
      rejected: 'rejected',
      suspended: 'suspended',
    })
  })
})

describe('stepIndexFromCurrentStep', () => {
  it('current_step 1–4 → bước 0–3, giá trị lạ bị kẹp lại', () => {
    expect(stepIndexFromCurrentStep(1)).toBe(0)
    expect(stepIndexFromCurrentStep(3)).toBe(2)
    expect(stepIndexFromCurrentStep(4)).toBe(3)
    expect(stepIndexFromCurrentStep(0)).toBe(0)
    expect(stepIndexFromCurrentStep(9)).toBe(3)
    expect(stepIndexFromCurrentStep(Number.NaN)).toBe(0)
  })
})

describe('isScrolledToBottom', () => {
  it('đã cuộn tới cuối (cho phép sai số nhỏ) hoặc nội dung không cần cuộn', () => {
    expect(isScrolledToBottom({ scrollTop: 0, clientHeight: 300, scrollHeight: 1000 })).toBe(false)
    expect(isScrolledToBottom({ scrollTop: 695, clientHeight: 300, scrollHeight: 1000 })).toBe(true)
    expect(isScrolledToBottom({ scrollTop: 0, clientHeight: 300, scrollHeight: 200 })).toBe(true)
  })
})
