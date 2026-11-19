import { Button, Paper, Skeleton, Stack, Tabs } from '@mantine/core'
import { IconBuildingStore } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import {
  ReadOnlyBanner,
  SellerActivityPanel,
  SellerDetailHeader,
  sellerDetailTabSchema,
  SellerProfilePanel,
  useAdminSeller,
  type SellerDetailTab,
} from '@/features/admin'
import { AnalyticsView } from '@/features/analytics'
import { CategoryManager } from '@/features/categories'
import { InventoryView } from '@/features/inventory'
import { OrdersView } from '@/features/orders'
import { ProductsView } from '@/features/products'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { SellerScopeProvider } from '@/shared/components/SellerScopeProvider'
import { ROUTES } from '@/shared/constants/routes'
import { getErrorMessage } from '@/shared/lib/errors'

const TABS: ReadonlyArray<{ value: SellerDetailTab; label: string }> = [
  { value: 'profile', label: 'Hồ sơ' },
  { value: 'products', label: 'Sản phẩm' },
  { value: 'categories', label: 'Danh mục' },
  { value: 'orders', label: 'Đơn hàng' },
  { value: 'inventory', label: 'Tồn kho' },
  { value: 'analytics', label: 'Phân tích' },
  { value: 'activity', label: 'Nhật ký' },
]

const sellerIdSchema = z.uuid()

/**
 * Chi tiết một shop: hồ sơ + hành động admin, và dashboard của shop ở chế độ CHỈ ĐỌC.
 * Các tab dữ liệu dùng lại đúng component của seller trong `SellerScopeProvider` (sellerId từ URL,
 * readOnly = true) — không impersonation, không sao chép code; database cũng chỉ cho admin đọc.
 */
export default function AdminSellerDetailPage() {
  const { sellerId = '' } = useParams()
  const validId = sellerIdSchema.safeParse(sellerId).success
  const seller = useAdminSeller(sellerId, validId)
  const [searchParams, setSearchParams] = useSearchParams()
  const { tab } = sellerDetailTabSchema.parse(Object.fromEntries(searchParams))

  if (!validId || seller.data === null) {
    return (
      <Paper withBorder radius="md" p="xl">
        <EmptyState
          icon={<IconBuildingStore size={24} stroke={1.5} />}
          title="Không tìm thấy shop"
          description="Shop không tồn tại hoặc đường dẫn không hợp lệ."
          action={
            <Button component={Link} to={ROUTES.adminSellers} variant="light" size="xs">
              Về danh sách shop
            </Button>
          }
        />
      </Paper>
    )
  }

  if (seller.isError) {
    return (
      <Paper withBorder radius="md" p="md">
        <ErrorState
          message={getErrorMessage(seller.error)}
          onRetry={() => void seller.refetch()}
          retrying={seller.isRefetching}
        />
      </Paper>
    )
  }

  if (seller.isPending) {
    return (
      <Stack gap="md" data-testid="seller-detail-skeleton">
        <Skeleton height={48} width="40%" />
        <Skeleton height={36} />
        <Skeleton height={320} />
      </Stack>
    )
  }

  const detail = seller.data
  if (!detail) return null

  const readOnly = (content: ReactNode) => (
    <SellerScopeProvider sellerId={detail.id} readOnly>
      <ReadOnlyBanner />
      {content}
    </SellerScopeProvider>
  )

  return (
    <>
      <SellerDetailHeader seller={detail} />
      <Tabs
        value={tab}
        // Đổi tab → bỏ bộ lọc / phân trang của tab cũ (các tab dùng chung URL search params).
        onChange={(value) => value && setSearchParams({ tab: value })}
        keepMounted={false}
        variant="outline"
      >
        <Tabs.List mb="md" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TABS.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="profile">
          <SellerProfilePanel seller={detail} />
        </Tabs.Panel>
        <Tabs.Panel value="products">{readOnly(<ProductsView />)}</Tabs.Panel>
        <Tabs.Panel value="categories">{readOnly(<CategoryManager />)}</Tabs.Panel>
        <Tabs.Panel value="orders">{readOnly(<OrdersView />)}</Tabs.Panel>
        <Tabs.Panel value="inventory">{readOnly(<InventoryView />)}</Tabs.Panel>
        <Tabs.Panel value="analytics">{readOnly(<AnalyticsView />)}</Tabs.Panel>
        <Tabs.Panel value="activity">
          <SellerActivityPanel sellerId={detail.id} ownerId={detail.owner_id} />
        </Tabs.Panel>
      </Tabs>
    </>
  )
}
