import { Center } from '@mantine/core'
import { SignOutButton } from '@/features/auth'
import { SellerStatusGuard } from '@/features/seller-onboarding'
import { useCurrentSeller } from '@/features/sellers'
import { ErrorState } from '@/shared/components/ErrorState'
import { PageLoader } from '@/shared/components/PageLoader'
import { SellerScopeProvider } from '@/shared/components/SellerScopeProvider'
import { getErrorMessage } from '@/shared/lib/errors'
import { DashboardLayout } from '../DashboardLayout'
import { LockedDashboardPreview } from './LockedDashboardPreview'

/**
 * Khung `/seller/*`: xác định shop của người đăng nhập (`seller_id` cho mọi dữ liệu kinh doanh),
 * cung cấp qua `SellerScopeProvider`, rồi mở hoặc khóa dashboard theo trạng thái shop.
 */
export function SellerLayout() {
  const seller = useCurrentSeller()

  if (seller.isPending) return <PageLoader />

  if (seller.isError || !seller.data) {
    return (
      <Center mih="100vh" px="md">
        <div>
          <ErrorState
            title="Không tải được thông tin shop"
            message={
              seller.isError
                ? getErrorMessage(seller.error)
                : 'Tài khoản này chưa có shop. Vui lòng liên hệ quản trị viên.'
            }
            onRetry={() => void seller.refetch()}
            retrying={seller.isRefetching}
          />
          <Center>
            <SignOutButton size="xs" />
          </Center>
        </div>
      </Center>
    )
  }

  // Shop đã đặt tên (bước 1 hồ sơ) → header hiển thị tên shop thay cho tên nền tảng.
  const brand = seller.data.shop_name ?? undefined

  return (
    <SellerScopeProvider sellerId={seller.data.id}>
      <SellerStatusGuard
        seller={seller.data}
        lockedView={
          <DashboardLayout brand={brand}>
            <LockedDashboardPreview />
          </DashboardLayout>
        }
      >
        <DashboardLayout brand={brand} />
      </SellerStatusGuard>
    </SellerScopeProvider>
  )
}
