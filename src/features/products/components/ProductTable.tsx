import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Menu,
  Stack,
  Table,
  Text,
  VisuallyHidden,
} from '@mantine/core'
import {
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
import { priceSchema, stockSchema } from '../schemas/product.schema'
import type { ProductSortField, SortOrder } from '../schemas/productFilters.schema'
import type { Product } from '../types'
import { ProductStock } from './ProductStock'
import { QuickEditNumber } from './QuickEditNumber'

export interface ProductTableActions {
  onEdit: (product: Product) => void
  onInsight: (product: Product) => void
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

function ProductRow({
  product,
  onEdit,
  onInsight,
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
        <Text size="sm" c={product.category ? undefined : 'dimmed'}>
          {product.category ?? '—'}
        </Text>
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
          <CostLine product={product} />
        </Stack>
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

/** Giá vốn + biên lãi gộp dưới giá bán (đỏ khi bán dưới giá vốn). */
function CostLine({ product }: { product: Product }) {
  const margin = calcMargin(product.price - product.cost_price, product.price)
  const loss = product.price < product.cost_price
  return (
    <Text size="xs" c={loss ? 'red' : 'dimmed'} style={{ whiteSpace: 'nowrap' }}>
      Vốn {formatCurrency(product.cost_price)}
      {margin !== null && ` · lãi ${formatPercent(margin)}`}
    </Text>
  )
}
