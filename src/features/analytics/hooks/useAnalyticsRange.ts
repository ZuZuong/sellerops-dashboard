import { useCallback, useMemo } from 'react'
import { useUrlState } from '@/shared/hooks/useUrlState'
import { todayKey, type DateKey } from '@/shared/lib/dates'
import {
  analyticsRangeSchema,
  resolveRange,
  type RangePreset,
} from '../schemas/analyticsRange.schema'

/** Khoảng thời gian báo cáo — URL là nguồn sự thật (chia sẻ link, Back/Forward giữ nguyên). */
export function useAnalyticsRange() {
  const { state, setState } = useUrlState(analyticsRangeSchema)
  const today = todayKey()
  const range = useMemo(() => resolveRange(state, today), [state, today])

  const setPreset = useCallback(
    (preset: RangePreset) => setState({ range: preset, from: '', to: '' }, { replace: true }),
    [setState],
  )

  const setCustom = useCallback(
    (from: DateKey, to: DateKey) => setState({ range: 'custom', from, to }, { replace: true }),
    [setState],
  )

  return { range, today, setPreset, setCustom }
}
