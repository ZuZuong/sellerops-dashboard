import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useEffectEvent, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

/**
 * Ô tìm kiếm đồng bộ với URL: giữ state cục bộ để gõ mượt, chỉ gọi `onCommit` (ghi lên URL) sau
 * `delay` ms ngừng gõ. URL đổi từ bên ngoài (Back/Forward, "Xóa bộ lọc") → đồng bộ lại ô nhập,
 * nhưng bỏ qua thay đổi do chính ô này ghi lên để không ghi đè ký tự người dùng vừa gõ thêm.
 */
export function useSearchInput(
  urlValue: string,
  onCommit: (value: string) => void,
  delay = SEARCH_DEBOUNCE_MS,
) {
  const [search, setSearch] = useState(urlValue)
  const [debouncedSearch] = useDebouncedValue(search, delay)

  const [syncedValue, setSyncedValue] = useState(urlValue)
  if (urlValue !== syncedValue) {
    setSyncedValue(urlValue)
    if (urlValue !== debouncedSearch.trim()) setSearch(urlValue)
  }

  // Chỉ phản ứng khi giá trị debounce đổi; đọc giá trị URL mới nhất mà không biến nó thành dependency.
  const commit = useEffectEvent((value: string) => {
    if (value !== urlValue) onCommit(value)
  })
  useEffect(() => {
    commit(debouncedSearch.trim())
  }, [debouncedSearch])

  return [search, setSearch] as const
}
