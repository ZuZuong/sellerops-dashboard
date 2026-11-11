import { Select } from '@mantine/core'
import { useMemo, type ReactNode } from 'react'
import type { RemoteSearchState } from '@/shared/hooks/useRemoteSearch'

interface RemoteSearchSelectProps<T> {
  label: string
  placeholder?: string
  value: T | null
  onChange: (item: T | null) => void
  onBlur?: () => void
  error?: string
  withAsterisk?: boolean
  /** Trạng thái ô tìm từ `useRemoteSearch` (feature tự gọi API theo `search.term`). */
  search: RemoteSearchState
  /** Kết quả tìm hiện tại từ server. */
  items: readonly T[] | undefined
  loading: boolean
  failed: boolean
  getKey: (item: T) => string
  getLabel: (item: T) => string
  renderOption?: (item: T) => ReactNode
  /** Mục đã chọn ở dòng khác — ẩn khỏi danh sách để không chọn trùng. */
  excludeKeys?: ReadonlySet<string>
}

/**
 * Select tìm phía server (không tải toàn bộ danh mục về trình duyệt). Mục đang chọn luôn được giữ
 * trong danh sách kể cả khi không nằm trong kết quả tìm hiện tại.
 */
export function RemoteSearchSelect<T>({
  label,
  placeholder = 'Tìm theo tên hoặc SKU…',
  value,
  onChange,
  onBlur,
  error,
  withAsterisk,
  search,
  items,
  loading,
  failed,
  getKey,
  getLabel,
  renderOption,
  excludeKeys,
}: RemoteSearchSelectProps<T>) {
  const byKey = useMemo(() => {
    const map = new Map<string, T>()
    for (const item of items ?? []) map.set(getKey(item), item)
    if (value) map.set(getKey(value), value)
    return map
  }, [items, value, getKey])

  const valueKey = value ? getKey(value) : null
  const data = [...byKey.entries()]
    .filter(([key]) => key === valueKey || !excludeKeys?.has(key))
    .map(([key, item]) => ({ value: key, label: getLabel(item) }))

  return (
    <Select
      label={label}
      placeholder={placeholder}
      searchable
      searchValue={search.search}
      onSearchChange={search.setSearch}
      // Đã lọc phía server; không lọc lại theo nhãn ở client (SKU không nằm trong nhãn).
      filter={({ options }) => options}
      data={data}
      value={valueKey}
      onChange={(key) => onChange(key ? (byKey.get(key) ?? null) : null)}
      onDropdownOpen={search.activate}
      onBlur={onBlur}
      nothingFoundMessage={
        loading ? 'Đang tìm…' : failed ? 'Không tải được dữ liệu' : 'Không có kết quả phù hợp'
      }
      renderOption={
        renderOption
          ? ({ option }) => {
              const item = byKey.get(option.value)
              return item ? renderOption(item) : option.label
            }
          : undefined
      }
      error={error}
      withAsterisk={withAsterisk}
      clearable
    />
  )
}
