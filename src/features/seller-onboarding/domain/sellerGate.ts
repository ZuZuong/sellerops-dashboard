import { isSellerActive, type SellerStatus } from '@/features/sellers'

/**
 * Màn hình chặn dashboard theo trạng thái shop. `open` = shop đã duyệt, dashboard mở.
 * Chỉ phục vụ UX: shop chưa duyệt vẫn bị RLS / RPC chặn mọi dữ liệu kinh doanh ở database.
 */
export type SellerGate = 'open' | Exclude<SellerStatus, 'approved'>

export function resolveSellerGate(status: SellerStatus): SellerGate {
  return isSellerActive(status) ? 'open' : (status as Exclude<SellerStatus, 'approved'>)
}

export const STEP_COUNT = 4

/** `sellers.current_step` (1–4, có thể lệch nếu dữ liệu cũ) → chỉ số bước của Stepper (0–3). */
export function stepIndexFromCurrentStep(currentStep: number): number {
  if (!Number.isFinite(currentStep)) return 0
  return Math.min(Math.max(Math.trunc(currentStep), 1), STEP_COUNT) - 1
}
