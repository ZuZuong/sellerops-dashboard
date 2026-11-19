import { Button, CloseButton, Group, Select, TextInput } from '@mantine/core'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useSearchInput } from '@/shared/hooks/useSearchInput'
import { useCategoryOptions } from '@/features/categories'
import type { useProductFilters } from '../hooks/useProductFilters'
import {
  parseSortOption,
  PRODUCT_SORT_OPTIONS,
  type ProductFilters as ProductFiltersState,
} from '../schemas/productFilters.schema'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Chưa đăng / ngừng bán' },
  { value: 'needs_category', label: 'Chưa có danh mục' },
]

const STATUS_VALUES = STATUS_OPTIONS.map((option) => option.value)
type StatusValue = ProductFiltersState['status']
const isStatus = (value: string | null): value is StatusValue =>
  value !== null && STATUS_VALUES.includes(value)

type ProductFiltersProps = Pick<
  ReturnType<typeof useProductFilters>,
  'filters' | 'setFilters' | 'setSort' | 'resetFilters' | 'hasActiveFilters'
>

export function ProductFilters({
  filters,
  setFilters,
  setSort,
  resetFilters,
  hasActiveFilters,
}: ProductFiltersProps) {
  const categories = useCategoryOptions()
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
        data={categories.data ?? []}
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
          if (isStatus(value)) setFilters({ status: value })
        }}
        allowDeselect={false}
        w={{ base: '100%', xs: 200 }}
      />
      <Select
        aria-label="Sắp xếp"
        data={PRODUCT_SORT_OPTIONS}
        value={`${filters.sort}:${filters.order}`}
        onChange={(value) => {
          const option = parseSortOption(value)
          if (option) setSort(option.sort, option.order)
        }}
        allowDeselect={false}
        w={{ base: '100%', xs: 190 }}
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
