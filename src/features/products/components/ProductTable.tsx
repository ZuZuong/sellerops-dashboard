import {
  ActionIcon,
  Badge,
  Center,
  Group,
  Menu,
  Table,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconDots,
  IconEdit,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { formatCurrency, formatDate } from '@/shared/lib/formatters'
import { priceSchema, stockSchema } from '../schemas/product.schema'
import type { ProductSortField, SortOrder } from '../schemas/productFilters.schema'
import type { Product } from '../types'
import { ProductStock } from './ProductStock'
import { QuickEditNumber } from './QuickEditNumber'

export interface ProductTableActions {
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  onDelete: (product: Product) => void
  onQuickPrice: (product: Product, price: number) => void
  onQuickStock: (product: Product, stock: number) => void
}

interface ProductTableProps extends ProductTableActions {
  products: Product[]
  sort: ProductSortField
  order: SortOrder
  onSort: (field: ProductSortField) => void
}

export const PRODUCT_TABLE_MIN_WIDTH = 860

export function ProductTable({ products, sort, order, onSort, ...actions }: ProductTableProps) {
  return (
    <ProductTableShell sort={sort} order={order} onSort={onSort}>
      {products.map((product) => (
        <ProductRow key={product.id} product={product} {...actions} />
      ))}
    </ProductTableShell>
  )
}

interface ProductTableShellProps {
  sort: ProductSortField
  order: SortOrder
  onSort?: (field: ProductSortField) => void
  children: ReactNode
}

/** Khung bảng + header sắp xếp; dùng chung cho bảng thật và skeleton. */
export function ProductTableShell({ sort, order, onSort, children }: ProductTableShellProps) {
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
            <Table.Th scope="col">SKU</Table.Th>
            {sortable('name', 'Tên sản phẩm')}
            <Table.Th scope="col">Danh mục</Table.Th>
            {sortable('price', 'Giá bán', 'right')}
            {sortable('stock', 'Tồn kho')}
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

interface SortableThProps {
  field: ProductSortField
  label: string
  align?: 'right'
  sort: ProductSortField
  order: SortOrder
  onSort?: (field: ProductSortField) => void
}

function SortableTh({ field, label, align, sort, order, onSort }: SortableThProps) {
  const active = sort === field
  const Icon = !active ? IconArrowsSort : order === 'asc' ? IconArrowUp : IconArrowDown
  return (
    <Table.Th
      scope="col"
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      ta={align}
    >
      <UnstyledButton
        onClick={() => onSort?.(field)}
        disabled={!onSort}
        fw={600}
        fz="sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        {label}
        <Center c={active ? undefined : 'dimmed'} aria-hidden>
          <Icon size={14} />
        </Center>
      </UnstyledButton>
    </Table.Th>
  )
}

function ProductRow({
  product,
  onEdit,
  onToggleActive,
  onDelete,
  onQuickPrice,
  onQuickStock,
}: { product: Product } & ProductTableActions) {
  return (
    <Table.Tr style={product.is_active ? undefined : { opacity: 0.7 }}>
      <Table.Td>
        <Text size="sm" ff="monospace">
          {product.sku}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500} lineClamp={2} maw={280}>
          {product.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c={product.category ? undefined : 'dimmed'}>
          {product.category ?? '—'}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
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
      </Table.Td>
      <Table.Td>
        <QuickEditNumber
          value={product.stock}
          label={`Sửa nhanh tồn kho của ${product.name}`}
          schema={stockSchema}
          display={<ProductStock product={product} />}
          onSave={(stock) => onQuickStock(product, stock)}
        />
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
              <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => onEdit(product)}>
                Sửa
              </Menu.Item>
              <Menu.Item
                leftSection={
                  product.is_active ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />
                }
                onClick={() => onToggleActive(product)}
              >
                {product.is_active ? 'Ngừng bán' : 'Đăng bán'}
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
