import { Button, CloseButton, Group, Select, TextInput } from '@mantine/core'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useSearchInput } from '@/shared/hooks/useSearchInput'
import { PRODUCT_CATEGORIES } from '../constants'
import type { useProductFilters } from '../hooks/useProductFilters'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Chưa đăng / ngừng bán' },
]

const STOCK_OPTIONS = [
  { value: 'all', label: 'Mọi mức tồn kho' },
  { value: 'low', label: 'Sắp hết hàng' },
  { value: 'out', label: 'Hết hàng' },
]

type ProductFiltersProps = Pick<
  ReturnType<typeof useProductFilters>,
  'filters' | 'setFilters' | 'resetFilters' | 'hasActiveFilters'
>

export function ProductFilters({
  filters,
  setFilters,
  resetFilters,
  hasActiveFilters,
}: ProductFiltersProps) {
  const [search, setSearch] = useSearchInput(filters.q, (q) => setFilters({ q }, { replace: true }))

  return (
    <Group gap="sm" align="flex-end" wrap="wrap" mb="md">
      <TextInput
        aria-label="Tìm theo tên hoặc SKU"
        placeholder="Tìm theo tên hoặc SKU…"
        leftSection={<IconSearch size={16} aria-hidden />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        rightSection={
          search ? (
            <CloseButton size="sm" aria-label="Xóa từ khóa" onClick={() => setSearch('')} />
          ) : null
        }
        style={{ flex: '1 1 240px' }}
      />
      <Select
        aria-label="Danh mục"
        placeholder="Tất cả danh mục"
        data={PRODUCT_CATEGORIES}
        value={filters.category || null}
        onChange={(value) => setFilters({ category: value ?? '' })}
        clearable
        searchable
        nothingFoundMessage="Không có danh mục phù hợp"
        w={{ base: '100%', xs: 180 }}
      />
      <Select
        aria-label="Trạng thái bán"
        data={STATUS_OPTIONS}
        value={filters.status}
        onChange={(value) => {
          if (value === 'all' || value === 'active' || value === 'inactive') {
            setFilters({ status: value })
          }
        }}
        allowDeselect={false}
        w={{ base: '100%', xs: 170 }}
      />
      <Select
        aria-label="Mức tồn kho"
        data={STOCK_OPTIONS}
        value={filters.stock}
        onChange={(value) => {
          if (value === 'all' || value === 'low' || value === 'out') setFilters({ stock: value })
        }}
        allowDeselect={false}
        w={{ base: '100%', xs: 170 }}
      />
      {hasActiveFilters && (
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconFilterOff size={16} aria-hidden />}
          onClick={resetFilters}
        >
          Xóa bộ lọc
        </Button>
      )}
    </Group>
  )
}
