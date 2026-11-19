import {
  ActionIcon,
  Avatar,
  Badge,
  Checkbox,
  Group,
  Menu,
  Stack,
  Table,
  Text,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconAlertCircleFilled,
  IconChartDots,
  IconDots,
  IconEdit,
  IconPhoto,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { SortableTh } from '@/shared/components/SortableTh'
import { formatCurrency, formatDate, formatPercent } from '@/shared/lib/formatters'
import { calcMargin } from '@/shared/lib/metrics'
import { getProductImageUrl } from '../api/productImages.api'
import { costPriceSchema, priceSchema } from '../schemas/product.schema'
import type { ProductSortField, SortOrder } from '../schemas/productFilters.schema'
import type { Product } from '../types'
import { QuickEditNumber } from './QuickEditNumber'

export interface ProductTableActions {
  onEdit: (product: Product) => void
  onInsight: (product: Product) => void
  onToggleActive: (product: Product) => void
  onDelete: (product: Product) => void
  onQuickPrice: (product: Product, price: number) => void
  onQuickCost: (product: Product, costPrice: number) => void
}

interface ProductTableProps extends ProductTableActions {
  products: Product[]
  sort: ProductSortField
  order: SortOrder
  onSort: (field: ProductSortField) => void
  /** Sản phẩm đang được chọn (để xóa nhiều). */
  selectedIds: ReadonlySet<string>
  onSelect: (product: Product, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
}

export const PRODUCT_TABLE_MIN_WIDTH = 900
/** Số cột của bảng (kể cả cột chọn) — dùng cho skeleton. */
export const PRODUCT_TABLE_COLUMNS = 9

export function ProductTable({
  products,
  sort,
  order,
  onSort,
  selectedIds,
  onSelect,
  onSelectAll,
  ...actions
}: ProductTableProps) {
  const selectedOnPage = products.filter((p) => selectedIds.has(p.id)).length
  return (
    <ProductTableShell
      sort={sort}
      order={order}
      onSort={onSort}
      selectAll={
        <Checkbox
          aria-label="Chọn tất cả sản phẩm trên trang"
          checked={products.length > 0 && selectedOnPage === products.length}
          indeterminate={selectedOnPage > 0 && selectedOnPage < products.length}
          onChange={(event) => onSelectAll(event.currentTarget.checked)}
        />
      }
    >
      {products.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          selected={selectedIds.has(product.id)}
          onSelect={onSelect}
          {...actions}
        />
      ))}
    </ProductTableShell>
  )
}

interface ProductTableShellProps {
  sort: ProductSortField
  order: SortOrder
  onSort?: (field: ProductSortField) => void
  /** Ô "chọn tất cả" ở đầu bảng; bỏ trống khi đang tải. */
  selectAll?: ReactNode
  children: ReactNode
}

/** Khung bảng + header sắp xếp; dùng chung cho bảng thật và skeleton. */
export function ProductTableShell({
  sort,
  order,
  onSort,
  selectAll,
  children,
}: ProductTableShellProps) {
  const sortable = (field: ProductSortField, label: string, align?: 'right') => (
    <SortableTh
      field={field}
      label={label}
      align={align}
      sort={sort}
      order={order}
      onSort={onSort}
    />
  )
  return (
    <Table.ScrollContainer minWidth={PRODUCT_TABLE_MIN_WIDTH}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col" w={40}>
              {selectAll ?? <VisuallyHidden>Chọn</VisuallyHidden>}
            </Table.Th>
            <Table.Th scope="col">SKU</Table.Th>
            {sortable('name', 'Tên sản phẩm')}
            <Table.Th scope="col">Danh mục</Table.Th>
            {sortable('cost_price', 'Giá vốn', 'right')}
            {sortable('price', 'Giá bán', 'right')}
            <Table.Th scope="col">Trạng thái</Table.Th>
            {sortable('created_at', 'Ngày tạo')}
            <Table.Th scope="col">
              <VisuallyHidden>Thao tác</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function ProductRow({
  product,
  selected,
  onSelect,
  onEdit,
  onInsight,
  onToggleActive,
  onDelete,
  onQuickPrice,
  onQuickCost,
}: {
  product: Product
  selected: boolean
  onSelect: (product: Product, selected: boolean) => void
} & ProductTableActions) {
  return (
    <Table.Tr
      style={product.is_active ? undefined : { opacity: 0.7 }}
      bg={selected ? 'var(--mantine-primary-color-light)' : undefined}
      aria-selected={selected}
    >
      <Table.Td>
        <Checkbox
          aria-label={`Chọn ${product.name}`}
          checked={selected}
          onChange={(event) => onSelect(product, event.currentTarget.checked)}
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm" ff="monospace">
          {product.sku}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar
            src={product.hero_image_path ? getProductImageUrl(product.hero_image_path) : null}
            alt=""
            radius="sm"
            size={40}
            color="gray"
          >
            <IconPhoto size={18} stroke={1.5} aria-hidden />
          </Avatar>
          <Text size="sm" fw={500} lineClamp={2} maw={260}>
            {product.name}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        {product.category_id === null ? (
          <Group gap={6} wrap="nowrap">
            <Text size="sm" c="dimmed">
              Chưa có
            </Text>
            <Tooltip
              label="Sản phẩm chưa có danh mục — chọn danh mục để đăng bán"
              events={{ hover: true, focus: true, touch: true }}
              multiline
              w={220}
            >
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                aria-label={`${product.name} chưa có danh mục — chọn danh mục`}
                onClick={() => onEdit(product)}
              >
                <IconAlertCircleFilled size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : (
          <Text size="sm" c={product.category ? undefined : 'dimmed'}>
            {product.category ?? '—'}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <QuickEditNumber
          value={Math.round(product.cost_price)}
          label={`Sửa nhanh giá vốn của ${product.name}`}
          schema={costPriceSchema}
          suffix=" ₫"
          display={
            <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatCurrency(product.cost_price)}
            </Text>
          }
          onSave={(costPrice) => onQuickCost(product, costPrice)}
        />
      </Table.Td>
      <Table.Td ta="right">
        <Stack gap={0} align="flex-end">
          <QuickEditNumber
            value={product.price}
            label={`Sửa nhanh giá của ${product.name}`}
            schema={priceSchema}
            suffix=" ₫"
            display={
              <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatCurrency(product.price)}
              </Text>
            }
            onSave={(price) => onQuickPrice(product, price)}
          />
          <MarginLine product={product} />
        </Stack>
      </Table.Td>
      <Table.Td>
        <Badge color={product.is_active ? 'green' : 'gray'} variant="light" radius="sm">
          {product.is_active ? 'Đang bán' : 'Chưa đăng'}
        </Badge>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        <Text size="sm" c="dimmed">
          {formatDate(product.created_at)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group justify="flex-end">
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Thao tác cho ${product.name}`}>
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconChartDots size={16} />}
                onClick={() => onInsight(product)}
              >
                Hiệu quả sản phẩm
              </Menu.Item>
              <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => onEdit(product)}>
                Sửa
              </Menu.Item>
              <Menu.Item
                leftSection={
                  product.is_active ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />
                }
                onClick={() => onToggleActive(product)}
                // Chưa có danh mục: DB không cho đăng bán, phải chọn danh mục trước.
                disabled={!product.is_active && product.category_id === null}
              >
                {product.is_active
                  ? 'Ngừng bán'
                  : product.category_id === null
                    ? 'Đăng bán (cần chọn danh mục)'
                    : 'Đăng bán'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => onDelete(product)}
              >
                Xóa
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

/** Biên lãi gộp dưới giá bán (đỏ + chữ "lỗ" khi bán dưới giá vốn, không chỉ dựa vào màu). */
function MarginLine({ product }: { product: Product }) {
  const margin = calcMargin(product.price - product.cost_price, product.price)
  if (margin === null) return null
  const loss = product.price < product.cost_price
  return (
    <Text size="xs" c={loss ? 'red' : 'dimmed'} style={{ whiteSpace: 'nowrap' }}>
      {loss ? 'Lỗ' : 'Lãi'} {formatPercent(Math.abs(margin))}
    </Text>
  )
}
