import { useMemo, type ReactNode } from 'react'
import { SellerScopeContext } from '@/shared/hooks/useSellerScope'

interface SellerScopeProviderProps {
  sellerId: string
  readOnly?: boolean
  children: ReactNode
}

/** Cung cấp shop đang xem cho cây component bên dưới (xem `useSellerScope`). */
export function SellerScopeProvider({
  sellerId,
  readOnly = false,
  children,
}: SellerScopeProviderProps) {
  const value = useMemo(() => ({ sellerId, readOnly }), [sellerId, readOnly])
  return <SellerScopeContext.Provider value={value}>{children}</SellerScopeContext.Provider>
}
