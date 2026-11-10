import { Button, CloseButton, Group, Select, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { PRODUCT_CATEGORIES } from '../constants'
import type { useProductFilters } from '../hooks/useProductFilters'

const SEARCH_DEBOUNCE_MS = 300

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
  // Ô tìm kiếm giữ state cục bộ để gõ mượt; chỉ ghi lên URL sau 300ms ngừng gõ.
  const [search, setSearch] = useState(filters.q)
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  // URL đổi từ bên ngoài (Back/Forward, nút "Xóa bộ lọc") → đồng bộ lại ô nhập.
  // Bỏ qua khi thay đổi do chính ô này ghi lên, để không ghi đè ký tự người dùng vừa gõ thêm.
  const [syncedQ, setSyncedQ] = useState(filters.q)
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q)
    if (filters.q !== debouncedSearch.trim()) setSearch(filters.q)
  }

  // Chỉ phản ứng khi giá trị debounce đổi; đọc filters mới nhất mà không biến nó thành dependency.
  const commitSearch = useEffectEvent((value: string) => {
    if (value !== filters.q) setFilters({ q: value }, { replace: true })
  })
  useEffect(() => {
    commitSearch(debouncedSearch.trim())
  }, [debouncedSearch])

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
