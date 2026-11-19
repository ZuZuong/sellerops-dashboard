import type { Seller } from '@/features/sellers'
import { resolveSellerGate, type SellerGate } from '../domain/sellerGate'

export interface SellerGateState {
  gate: SellerGate
  /** Dashboard bị khóa (mọi trạng thái trừ `approved`). */
  locked: boolean
}

export function useSellerGate(seller: Pick<Seller, 'status'>): SellerGateState {
  const gate = resolveSellerGate(seller.status)
  return { gate, locked: gate !== 'open' }
}
