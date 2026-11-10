import { Button, Group, Pagination, Paper, Select, Skeleton, Table, Text } from '@mantine/core'
import { IconPackage, IconSearchOff } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatNumber } from '@/shared/lib/formatters'
import {
  useDeleteProduct,
  useProducts,
  useQuickAdjustStock,
  useQuickUpdatePrice,
  useSetProductActive,
} from '../api/products.queries'
import { useProductFilters } from '../hooks/useProductFilters'
import { PRODUCT_PAGE_SIZES } from '../schemas/productFilters.schema'
import type { Product } from '../types'
import { CreateProductButton } from './CreateProductButton'
import { ProductFilters } from './ProductFilters'
import { ProductFormModal } from './ProductFormModal'
import { ProductTable, ProductTableShell } from './ProductTable'

type PendingConfirm = { type: 'delete' | 'deactivate'; product: Product } | null

const PAGE_SIZE_OPTIONS = PRODUCT_PAGE_SIZES.map((size) => ({
  value: String(size),
  label: `${size} / trang`,
}))

/** Danh sách sản phẩm: filter + bảng + phân trang + các hộp thoại sửa / xác nhận. */
export function ProductsView() {
  const productFilters = useProductFilters()
  const { filters, setFilters, setPage, toggleSort, resetFilters, hasActiveFilters } =
    productFilters
  const products = useProducts(filters)

  const [editing, setEditing] = useState<Product | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm>(null)

  const setActive = useSetProductActive()
  const deleteProduct = useDeleteProduct()
  const quickPrice = useQuickUpdatePrice()
  const quickStock = useQuickAdjustStock()

  const total = products.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))

  // Trang hiện tại vượt quá số trang (vd. sau khi xóa sản phẩm cuối của trang) → lùi về trang cuối.
  useEffect(() => {
    if (products.data && !products.isPlaceholderData && filters.page > totalPages) {
      setPage(totalPages)
    }
  }, [filters.page, products.data, products.isPlaceholderData, setPage, totalPages])

  const handleToggleActive = (product: Product) => {
    // Ngừng bán là thao tác ảnh hưởng bán hàng → xác nhận; đăng bán thì làm luôn.
    if (product.is_active) setConfirm({ type: 'deactivate', product })
    else setActive.mutate({ product, isActive: true })
  }

  const handleConfirm = () => {
    if (!confirm) return
    const close = { onSettled: () => setConfirm(null) }
    if (confirm.type === 'delete') deleteProduct.mutate(confirm.product, close)
    else setActive.mutate({ product: confirm.product, isActive: false }, close)
  }

  const renderBody = () => {
    if (products.isPending) {
      return (
        <ProductTableShell sort={filters.sort} order={filters.order}>
          {Array.from({ length: Math.min(filters.pageSize, 10) }, (_, i) => (
            <Table.Tr key={i} data-testid="product-row-skeleton">
              {Array.from({ length: 8 }, (_, j) => (
                <Table.Td key={j}>
                  <Skeleton height={14} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </ProductTableShell>
      )
    }

    if (products.isError) {
      return (
        <ErrorState
          message={getErrorMessage(products.error)}
          onRetry={() => void products.refetch()}
          retrying={products.isRefetching}
        />
      )
    }

    if (products.data.items.length === 0) {
      return hasActiveFilters ? (
        <EmptyState
          icon={<IconSearchOff size={24} stroke={1.5} />}
          title="Không tìm thấy sản phẩm phù hợp"
          description="Thử từ khóa khác hoặc bỏ bớt điều kiện lọc."
          action={
            <Button variant="light" size="xs" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={<IconPackage size={24} stroke={1.5} />}
          title="Chưa có sản phẩm nào"
          description="Thêm sản phẩm đầu tiên để bắt đầu tạo đơn hàng và theo dõi tồn kho."
          action={<CreateProductButton size="xs" variant="light" />}
        />
      ) : null // đang lùi về trang hợp lệ (effect ở trên)
    }

    return (
      <ProductTable
        products={products.data.items}
        sort={filters.sort}
        order={filters.order}
        onSort={toggleSort}
        onEdit={setEditing}
        onToggleActive={handleToggleActive}
        onDelete={(product) => setConfirm({ type: 'delete', product })}
        onQuickPrice={(product, price) => quickPrice.mutate({ product, price })}
        onQuickStock={(product, stock) => quickStock.mutate({ product, stock })}
      />
    )
  }

  const from = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1
  const to = Math.min(filters.page * filters.pageSize, total)
  const confirmProduct = confirm?.product

  return (
    <Paper withBorder radius="md" p="md">
      <ProductFilters
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div aria-busy={products.isFetching}>{renderBody()}</div>

      {products.data && total > 0 && (
        <Group justify="space-between" mt="md" gap="sm" wrap="wrap">
          <Text size="sm" c="dimmed">
            Hiển thị {formatNumber(from)}–{formatNumber(to)} trong {formatNumber(total)} sản phẩm
          </Text>
          <Group gap="sm" wrap="wrap">
            <Select
              aria-label="Số sản phẩm mỗi trang"
              data={PAGE_SIZE_OPTIONS}
              value={String(filters.pageSize)}
              onChange={(value) => value && setFilters({ pageSize: Number(value) })}
              allowDeselect={false}
              w={130}
            />
            <Pagination
              total={totalPages}
              value={Math.min(filters.page, totalPages)}
              onChange={setPage}
              siblings={1}
              boundaries={1}
              getControlProps={(control) => ({
                'aria-label': control === 'previous' ? 'Trang trước' : 'Trang sau',
              })}
              getItemProps={(page) => ({ 'aria-label': `Trang ${page}` })}
            />
          </Group>
        </Group>
      )}

      <ProductFormModal
        opened={editing !== null}
        product={editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        opened={confirm !== null}
        title={confirm?.type === 'delete' ? 'Xóa sản phẩm?' : 'Ngừng bán sản phẩm?'}
        message={
          confirm?.type === 'delete'
            ? `"${confirmProduct?.name}" sẽ bị xóa vĩnh viễn. Sản phẩm đã có trong đơn hàng không thể xóa — hãy dùng "Ngừng bán".`
            : `"${confirmProduct?.name}" sẽ không thể thêm vào đơn hàng mới. Đơn hàng cũ không bị ảnh hưởng.`
        }
        confirmLabel={confirm?.type === 'delete' ? 'Xóa vĩnh viễn' : 'Ngừng bán'}
        color={confirm?.type === 'delete' ? 'red' : 'orange'}
        loading={deleteProduct.isPending || (confirm?.type === 'deactivate' && setActive.isPending)}
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      />
    </Paper>
  )
}
