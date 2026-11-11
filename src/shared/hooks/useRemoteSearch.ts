import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'
import { SEARCH_DEBOUNCE_MS } from './useSearchInput'

/**
 * Trạng thái ô tìm của một Select tìm phía server: chữ đang gõ, từ khóa đã debounce (300ms) và
 * cờ "đã mở dropdown" (chỉ gọi API khi người dùng thật sự mở ô chọn).
 *
 * `selectedLabel`: Select hiển thị nhãn của mục đang chọn trong ô tìm → không coi đó là từ khóa.
 */
export function useRemoteSearch(selectedLabel: string | null) {
  const [search, setSearch] = useState('')
  const [activated, setActivated] = useState(false)
  const raw = selectedLabel !== null && search === selectedLabel ? '' : search
  const [term] = useDebouncedValue(raw.trim(), SEARCH_DEBOUNCE_MS)

  return { search, setSearch, term, activated, activate: () => setActivated(true) }
}

export type RemoteSearchState = ReturnType<typeof useRemoteSearch>
