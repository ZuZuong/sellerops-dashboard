import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconBuildingStore,
  IconChecklist,
  IconDots,
  IconLock,
  IconLockOpen,
  IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { adminSellerPath } from '@/shared/constants/routes'
import { useUrlState } from '@/shared/hooks/useUrlState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/shared/lib/formatters'
import { useAdminSellers, useSetSellerSuspended } from '../api/admin.queries'
import { NUMERIC_STYLE } from '../lib/styles'
import { sellerFiltersSchema, type SellerFilters } from '../schemas/adminFilters.schema'
import type { AdminSeller, DeletionTarget } from '../types'
import { AccountStateBadge, AdminPagination, SearchField, SellerStatusBadge } from './common'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { ReasonDialog } from './ReasonDialog'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'suspended', label: 'Tạm khóa' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'draft', label: 'Đang làm hồ sơ' },
]

/** Quản lý shop: lọc theo trạng thái (URL), tìm kiếm, tạm khóa / mở khóa, xóa tài khoản chủ shop. */
export function SellersView() {
  const { state: filters, setState } = useUrlState(sellerFiltersSchema)
  const setFilters = (patch: Partial<SellerFilters>, replace = false) =>
    setState({ page: 1, ...patch }, { replace })

  return (
    <Paper withBorder radius="md" p="md">
      {/* Một hàng: ô tìm kiếm co giãn, bộ lọc trạng thái bên phải; màn hình hẹp tự xuống dòng. */}
      <Group gap="sm" mb="md" wrap="wrap" align="center">
        <SearchField
          value={filters.q}
          onCommit={(q) => setFilters({ q }, true)}
          placeholder="Tìm theo tên shop, doanh nghiệp, email, mã số thuế…"
        />
        <SegmentedControl
          aria-label="Lọc theo trạng thái shop"
          data={STATUS_OPTIONS}
          value={filters.status}
          onChange={(value) => {
            const status = sellerFiltersSchema.shape.status.safeParse(value)
            if (status.success) setFilters({ status: status.data })
          }}
          style={{ maxWidth: '100%', overflowX: 'auto' }}
        />
      </Group>
      <SellersTable
        filters={filters}
        onPage={(page) => setState({ page })}
        onPageSize={(pageSize) => setFilters({ pageSize })}
      />
    </Paper>
  )
}

/** Hàng đợi duyệt hồ sơ: shop `pending`, hồ sơ gửi sớm nhất lên trước. */
export function ApprovalsView() {
  const { state: filters, setState } = useUrlState(sellerFiltersSchema)
  const queue = { ...filters, status: 'pending' as const }
  return (
    <Paper withBorder radius="md" p="md">
      <Group mb="md">
        <SearchField
          value={filters.q}
          onCommit={(q) => setState({ q, page: 1 }, { replace: true })}
          placeholder="Tìm trong hàng đợi…"
        />
      </Group>
      <SellersTable
        filters={queue}
        mode="approvals"
        onPage={(page) => setState({ page })}
        onPageSize={(pageSize) => setState({ pageSize, page: 1 })}
      />
    </Paper>
  )
}

interface SellersTableProps {
  filters: SellerFilters
  mode?: 'sellers' | 'approvals'
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

function SellersTable({ filters, mode = 'sellers', onPage, onPageSize }: SellersTableProps) {
  const sellers = useAdminSellers(filters)
  const suspend = useSetSellerSuspended()
  const [suspending, setSuspending] = useState<AdminSeller | null>(null)
  const [deleting, setDeleting] = useState<DeletionTarget | null>(null)
  const approvals = mode === 'approvals'
  const columns = approvals ? 5 : 7

  if (sellers.isError) {
    return (
      <ErrorState
        message={getErrorMessage(sellers.error)}
        onRetry={() => void sellers.refetch()}
        retrying={sellers.isRefetching}
      />
    )
  }

  if (sellers.data && sellers.data.items.length === 0) {
    return approvals ? (
      <EmptyState
        icon={<IconChecklist size={24} stroke={1.5} />}
        title="Không có hồ sơ chờ duyệt"
        description="Hồ sơ mới gửi sẽ xuất hiện ở đây."
      />
    ) : (
      <EmptyState
        icon={<IconBuildingStore size={24} stroke={1.5} />}
        title="Không có shop phù hợp"
        description="Thử từ khóa khác hoặc chọn trạng thái khác."
      />
    )
  }

  const isSuspended = suspending?.status === 'suspended'

  return (
    <>
      <Table.ScrollContainer minWidth={approvals ? 760 : 980}>
        <Table verticalSpacing="xs" highlightOnHover aria-busy={sellers.isFetching}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Shop</Table.Th>
              <Table.Th scope="col">Chủ shop</Table.Th>
              {approvals ? (
                <Table.Th scope="col">Gửi hồ sơ lúc</Table.Th>
              ) : (
                <>
                  <Table.Th scope="col">Trạng thái</Table.Th>
                  <Table.Th scope="col" ta="right">
                    Sản phẩm
                  </Table.Th>
                  <Table.Th scope="col" ta="right">
                    Đơn hàng
                  </Table.Th>
                  <Table.Th scope="col" ta="right">
                    Doanh số
                  </Table.Th>
                </>
              )}
              {approvals && <Table.Th scope="col">Ngày tạo shop</Table.Th>}
              <Table.Th scope="col">
                <VisuallyHidden>Thao tác</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sellers.isPending
              ? Array.from({ length: 6 }, (_, i) => (
                  <Table.Tr key={i} data-testid="seller-row-skeleton">
                    {Array.from({ length: columns }, (_, j) => (
                      <Table.Td key={j}>
                        <Skeleton height={14} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              : sellers.data.items.map((seller) => (
                  <Table.Tr key={seller.id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text
                          component={Link}
                          to={adminSellerPath(seller.id)}
                          size="sm"
                          fw={600}
                          truncate="end"
                          maw={260}
                        >
                          {seller.shop_name ?? 'Chưa đặt tên'}
                        </Text>
                        <Text size="xs" c="dimmed" truncate="end" maw={260}>
                          {seller.business_name ?? '—'}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2} align="flex-start">
                        <Text size="sm" truncate="end" maw={240}>
                          {seller.owner_email}
                        </Text>
                        {(seller.account_status !== 'active' || seller.is_locked) && (
                          <AccountStateBadge account={seller} />
                        )}
                      </Stack>
                    </Table.Td>
                    {approvals ? (
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="sm">
                          {seller.submitted_at ? formatDateTime(seller.submitted_at) : '—'}
                        </Text>
                      </Table.Td>
                    ) : (
                      <>
                        <Table.Td>
                          <SellerStatusBadge status={seller.status} />
                        </Table.Td>
                        <Table.Td ta="right" style={NUMERIC_STYLE}>
                          {formatNumber(seller.product_count)}
                        </Table.Td>
                        <Table.Td ta="right" style={NUMERIC_STYLE}>
                          {formatNumber(seller.order_count)}
                        </Table.Td>
                        <Table.Td ta="right" style={NUMERIC_STYLE}>
                          {formatCurrency(seller.revenue)}
                        </Table.Td>
                      </>
                    )}
                    {approvals && (
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="sm" c="dimmed">
                          {formatDate(seller.created_at)}
                        </Text>
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Group justify="flex-end" gap={4} wrap="nowrap">
                        <Button
                          component={Link}
                          to={adminSellerPath(seller.id)}
                          size="compact-xs"
                          variant={approvals ? 'filled' : 'subtle'}
                        >
                          {approvals ? 'Xem và duyệt' : 'Xem'}
                        </Button>
                        {!approvals && (
                          <SellerMenu
                            seller={seller}
                            onSuspend={() => setSuspending(seller)}
                            onDelete={() =>
                              setDeleting({
                                userId: seller.owner_id,
                                email: seller.owner_email,
                                shopName: seller.shop_name,
                              })
                            }
                          />
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <AdminPagination
        total={sellers.data?.total ?? 0}
        page={filters.page}
        pageSize={filters.pageSize}
        unit={approvals ? 'hồ sơ' : 'shop'}
        onPage={onPage}
        onPageSize={onPageSize}
      />

      <ReasonDialog
        opened={suspending !== null}
        title={isSuspended ? 'Mở khóa shop' : 'Tạm khóa shop'}
        description={
          isSuspended
            ? `Mở khóa "${suspending?.shop_name ?? ''}": dashboard của seller hoạt động lại ngay.`
            : `Tạm khóa "${suspending?.shop_name ?? ''}": dashboard của seller bị khóa ngay, seller thấy lý do trên màn hình.`
        }
        confirmLabel={isSuspended ? 'Mở khóa shop' : 'Tạm khóa shop'}
        color={isSuspended ? 'green' : 'red'}
        reasonRequired={!isSuspended}
        loading={suspend.isPending}
        onConfirm={(reason) => {
          if (!suspending) return
          suspend.mutate(
            {
              sellerId: suspending.id,
              shopName: suspending.shop_name,
              suspended: !isSuspended,
              reason,
            },
            { onSuccess: () => setSuspending(null) },
          )
        }}
        onClose={() => setSuspending(null)}
      />
      <DeleteAccountDialog target={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

function SellerMenu({
  seller,
  onSuspend,
  onDelete,
}: {
  seller: AdminSeller
  onSuspend: () => void
  onDelete: () => void
}) {
  const canSuspend = seller.status === 'approved' || seller.status === 'suspended'
  const canDelete = seller.account_status === 'active'
  if (!canSuspend && !canDelete) return null
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Thao tác cho ${seller.shop_name ?? seller.owner_email}`}
        >
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {canSuspend && (
          <Menu.Item
            leftSection={
              seller.status === 'suspended' ? <IconLockOpen size={16} /> : <IconLock size={16} />
            }
            onClick={onSuspend}
          >
            {seller.status === 'suspended' ? 'Mở khóa shop' : 'Tạm khóa shop'}
          </Menu.Item>
        )}
        {canSuspend && canDelete && <Menu.Divider />}
        {canDelete && (
          <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
            Xóa tài khoản chủ shop
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
