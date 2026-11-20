import { describe, expect, it } from 'vitest'
import {
  canTransitionSeller,
  isApplicationEditable,
  isSellerActive,
  isSellerStatus,
  SELLER_STATUSES,
  SELLER_TRANSITIONS,
} from '@/features/sellers/domain/sellerStatus'

/** Nội dung mọi migration (Vite đọc lúc chạy test), sắp theo tên file = thứ tự áp dụng. */
const migrations = import.meta.glob<string>('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Lấy các cặp "from>to" trong hàm SQL seller_status_can_transition (bản mới nhất). */
function sqlTransitions(): string[] {
  let body: string | null = null
  for (const file of Object.keys(migrations).sort()) {
    const match = /function public\.seller_status_can_transition[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(
      migrations[file] ?? '',
    )
    if (match?.[1]) body = match[1]
  }
  if (!body) throw new Error('Không tìm thấy seller_status_can_transition trong migrations')
  return [...body.matchAll(/'([a-z]+>[a-z]+)'/g)].map((m) => m[1] ?? '').sort()
}

const tsTransitions = () =>
  SELLER_STATUSES.flatMap((from) => SELLER_TRANSITIONS[from].map((to) => `${from}>${to}`)).sort()

describe('seller status state machine', () => {
  it('khớp tuyệt đối với hàm SQL seller_status_can_transition', () => {
    expect(tsTransitions()).toEqual(sqlTransitions())
  })

  it('luồng duyệt hợp lệ', () => {
    expect(canTransitionSeller('draft', 'pending')).toBe(true)
    expect(canTransitionSeller('pending', 'approved')).toBe(true)
    expect(canTransitionSeller('pending', 'rejected')).toBe(true)
    expect(canTransitionSeller('rejected', 'pending')).toBe(true)
    expect(canTransitionSeller('approved', 'suspended')).toBe(true)
    expect(canTransitionSeller('suspended', 'approved')).toBe(true)
  })

  it('chặn chuyển trạng thái sai', () => {
    expect(canTransitionSeller('draft', 'approved')).toBe(false)
    expect(canTransitionSeller('rejected', 'approved')).toBe(false)
    expect(canTransitionSeller('approved', 'draft')).toBe(false)
    expect(canTransitionSeller('suspended', 'pending')).toBe(false)
    expect(canTransitionSeller('pending', 'suspended')).toBe(false)
  })

  it('chỉ shop approved dùng được dashboard; chỉ draft / rejected sửa được hồ sơ', () => {
    expect(SELLER_STATUSES.filter(isSellerActive)).toEqual(['approved'])
    expect(SELLER_STATUSES.filter(isApplicationEditable)).toEqual(['draft', 'rejected'])
  })

  it('isSellerStatus', () => {
    expect(isSellerStatus('pending')).toBe(true)
    expect(isSellerStatus('deleted')).toBe(false)
    expect(isSellerStatus(null)).toBe(false)
  })
})
