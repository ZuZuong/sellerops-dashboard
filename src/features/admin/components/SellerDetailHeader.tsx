import { Group, Text } from '@mantine/core'
import { ROUTES } from '@/shared/constants/routes'
import type { AdminSellerDetail } from '../types'
import { AccountStateBadge, AdminPageHeader, SellerStatusBadge } from './common'

/** Tiêu đề trang chi tiết shop: tên shop, trạng thái shop / tài khoản chủ shop, breadcrumb. */
export function SellerDetailHeader({ seller }: { seller: AdminSellerDetail }) {
  const name = seller.shop_name ?? 'Shop chưa đặt tên'
  return (
    <>
      <AdminPageHeader
        title={name}
        crumbs={[{ label: 'Shop', to: ROUTES.adminSellers }, { label: name }]}
        actions={
          <Group gap="xs">
            <SellerStatusBadge status={seller.status} />
            {(seller.account_status !== 'active' || seller.is_locked) && (
              <AccountStateBadge account={seller} />
            )}
          </Group>
        }
      />
      <Text size="sm" c="dimmed" mt={-12} mb="md">
        Chủ shop: {seller.owner_full_name ? `${seller.owner_full_name} · ` : ''}
        {seller.owner_email}
      </Text>
    </>
  )
}
