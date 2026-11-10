import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import {
  DEFAULT_DASHBOARD_RANGE,
  parseDashboardRange,
  RANGE_DAYS,
  type DashboardRange,
} from '../schemas/dashboardRange.schema'

const PARAM = 'range'

/**
 * Khoảng thời gian của dashboard lấy từ URL (`?range=7d`): chia sẻ link hay F5 vẫn giữ nguyên.
 * Giá trị mặc định không ghi lên URL cho gọn; đổi khoảng dùng `replace` để không làm dài history.
 */
export function useDashboardRange() {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseDashboardRange(searchParams.get(PARAM))

  const setRange = useCallback(
    (next: DashboardRange) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === DEFAULT_DASHBOARD_RANGE) params.delete(PARAM)
          else params.set(PARAM, next)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { range, days: RANGE_DAYS[range], setRange }
}
