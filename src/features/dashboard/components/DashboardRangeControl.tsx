import { SegmentedControl } from '@mantine/core'
import { useDashboardRange } from '../hooks/useDashboardRange'
import { dashboardRangeSchema } from '../schemas/dashboardRange.schema'

const OPTIONS = [
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' },
]

export function DashboardRangeControl() {
  const { range, setRange } = useDashboardRange()
  return (
    <SegmentedControl
      aria-label="Khoảng thời gian"
      data={OPTIONS}
      value={range}
      onChange={(value) => {
        const parsed = dashboardRangeSchema.safeParse(value)
        if (parsed.success) setRange(parsed.data)
      }}
    />
  )
}
