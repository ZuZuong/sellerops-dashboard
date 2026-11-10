import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { z } from 'zod'

type UrlValue = string | number
type UrlStateShape = Record<string, UrlValue>

export interface SetUrlStateOptions {
  /** Thay entry hiện tại thay vì thêm vào history (vd. khi đang gõ tìm kiếm). */
  replace?: boolean
}

/**
 * Đồng bộ một nhóm state (filter / sort / phân trang) với URL search params — URL là nguồn sự thật.
 *
 * `schema` phải parse được object rỗng: mỗi trường khai báo `.catch(mặcĐịnh)` để giá trị thiếu hoặc
 * không hợp lệ trên URL (do người dùng sửa tay) rơi về mặc định thay vì làm hỏng trang.
 * Giá trị bằng mặc định không ghi lên URL để link gọn; tham số không thuộc schema được giữ nguyên.
 */
export function useUrlState<T extends UrlStateShape>(schema: z.ZodType<T>) {
  const [searchParams, setSearchParams] = useSearchParams()

  const defaults = useMemo(() => schema.parse({}), [schema])
  const state = useMemo(
    () => schema.parse(Object.fromEntries(searchParams)),
    [schema, searchParams],
  )

  const setState = useCallback(
    (patch: Partial<T>, options?: SetUrlStateOptions) => {
      setSearchParams(
        (prev) => {
          const current = schema.parse(Object.fromEntries(prev))
          // Parse lại để giá trị ghi lên URL luôn hợp lệ theo schema.
          const next = schema.parse({ ...current, ...patch })
          const params = new URLSearchParams(prev)
          for (const key of Object.keys(defaults)) {
            const value = next[key]
            if (value === undefined || value === '' || value === defaults[key]) params.delete(key)
            else params.set(key, String(value))
          }
          return params
        },
        { replace: options?.replace },
      )
    },
    [defaults, schema, setSearchParams],
  )

  const reset = useCallback(
    (options?: SetUrlStateOptions) => setState(defaults, options),
    [defaults, setState],
  )

  return { state, setState, reset, defaults }
}
