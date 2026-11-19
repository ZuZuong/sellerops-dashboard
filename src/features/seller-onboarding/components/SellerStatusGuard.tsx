import type { ReactNode } from 'react'
import type { Seller } from '@/features/sellers'
import { useSellerGate } from '../hooks/useSellerGate'
import { SellerGateModal } from './SellerGateModal'

interface SellerStatusGuardProps {
  seller: Seller
  /** Dashboard thật — chỉ render khi shop `approved`. */
  children: ReactNode
  /**
   * Khung dashboard hiển thị phía sau modal khi bị khóa. Không render trang thật để không gọi
   * dữ liệu kinh doanh (database cũng sẽ từ chối).
   */
  lockedView: ReactNode
}

/**
 * Chặn dashboard theo trạng thái shop. Khi chưa `approved`: nền dashboard bị vô hiệu hoàn toàn
 * (`inert` → không focus / bấm được, `aria-hidden` → trình đọc màn hình bỏ qua) và hiện
 * `SellerGateModal` không đóng được.
 */
export function SellerStatusGuard({ seller, children, lockedView }: SellerStatusGuardProps) {
  const { locked } = useSellerGate(seller)
  if (!locked) return children

  return (
    <>
      <div inert aria-hidden="true" data-testid="locked-dashboard">
        {lockedView}
      </div>
      <SellerGateModal seller={seller} />
    </>
  )
}
