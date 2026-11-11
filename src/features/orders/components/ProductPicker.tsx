import { Group, Select, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useMemo, useState } from 'react'
import { SEARCH_DEBOUNCE_MS } from '@/shared/hooks/useSearchInput'
import { formatCurrency, formatNumber } from '@/shared/lib/formatters'
import { useOrderableProducts } from '../api/orders.queries'
import type { OrderableProduct } from '../types'

interface ProductPickerProps {
  label: string
  value: OrderableProduct | null
  onChange: (product: OrderableProduct | null) => void
  onBlur?: () => void
  /** Sản phẩm đã chọn ở dòng khác — ẩn khỏi danh sách để không chọn trùng. */
  excludeIds: ReadonlySet<string>
  error?: string
}

/**
 * Ô chọn sản phẩm đang bán, tìm theo tên / SKU phía server (debounce 300ms) thay vì tải toàn bộ
 * danh mục. Chỉ tải khi mở dropdown lần đầu.
 */
export function ProductPicker({
  label,
  value,
  onChange,
  onBlur,
  excludeIds,
  error,
}: ProductPickerProps) {
  const [search, setSearch] = useState('')
  const [activated, setActivated] = useState(false)
  // Khi đã chọn, Select hiển thị tên sản phẩm trong ô tìm → không lấy đó làm từ khóa.
  const term = value && search === value.name ? '' : search
  const [debouncedTerm] = useDebouncedValue(term.trim(), SEARCH_DEBOUNCE_MS)
  const products = useOrderableProducts(debouncedTerm, activated)

  const byId = useMemo(() => {
    const map = new Map<string, OrderableProduct>()
    for (const product of products.data ?? []) map.set(product.id, product)
    // Giữ sản phẩm đang chọn trong danh sách kể cả khi không nằm trong kết quả tìm hiện tại.
    if (value) map.set(value.id, value)
    return map
  }, [products.data, value])

  const data = [...byId.values()]
    .filter((product) => product.id === value?.id || !excludeIds.has(product.id))
    .map((product) => ({ value: product.id, label: product.name }))

  return (
    <Select
      label={label}
      placeholder="Tìm theo tên hoặc SKU…"
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      // Đã lọc phía server; không lọc lại theo nhãn ở client (SKU không nằm trong nhãn).
      filter={({ options }) => options}
      data={data}
      value={value?.id ?? null}
      onChange={(id) => onChange(id ? (byId.get(id) ?? null) : null)}
      onDropdownOpen={() => setActivated(true)}
      onBlur={onBlur}
      nothingFoundMessage={
        products.isFetching
          ? 'Đang tìm…'
          : products.isError
            ? 'Không tải được sản phẩm'
            : 'Không có sản phẩm phù hợp'
      }
      renderOption={({ option }) => {
        const product = byId.get(option.value)
        if (!product) return option.label
        return (
          <Stack gap={0}>
            <Text size="sm">{product.name}</Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed" ff="monospace">
                {product.sku}
              </Text>
              <Text size="xs" c="dimmed">
                · {formatCurrency(product.price)} · Tồn {formatNumber(product.stock)}
              </Text>
            </Group>
          </Stack>
        )
      }}
      error={error}
      withAsterisk
      clearable
    />
  )
}
