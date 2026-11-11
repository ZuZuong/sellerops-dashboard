import { Chip, Group, Stack, Text, TextInput } from '@mantine/core'
import { useAnalyticsRange } from '../hooks/useAnalyticsRange'
import {
  MAX_RANGE_DAYS,
  RANGE_PRESET_LABELS,
  RANGE_PRESETS,
  type RangePreset,
} from '../schemas/analyticsRange.schema'
import { formatDate, formatNumber } from '@/shared/lib/formatters'

function isPreset(value: string): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value)
}

/**
 * Bộ chọn khoảng thời gian: preset nhanh + hai ô ngày (input type="date" gốc của trình duyệt —
 * có sẵn bàn phím, trình đọc màn hình và lịch trên mobile, không thêm thư viện).
 */
export function AnalyticsRangeControl() {
  const { range, today, setPreset, setCustom } = useAnalyticsRange()

  return (
    <Stack gap="xs">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Chip.Group
          multiple={false}
          value={range.preset}
          onChange={(value) => {
            if (isPreset(value)) setPreset(value)
          }}
        >
          <Group gap="xs" wrap="wrap" role="radiogroup" aria-label="Khoảng thời gian nhanh">
            {RANGE_PRESETS.map((preset) => (
              <Chip key={preset} value={preset} size="sm" variant="light">
                {RANGE_PRESET_LABELS[preset]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            type="date"
            label="Từ ngày"
            size="xs"
            value={range.from}
            max={range.to}
            onChange={(event) => {
              const from = event.currentTarget.value
              if (from) setCustom(from, range.to)
            }}
          />
          <TextInput
            type="date"
            label="Đến ngày"
            size="xs"
            value={range.to}
            min={range.from}
            max={today}
            onChange={(event) => {
              const to = event.currentTarget.value
              if (to) setCustom(range.from, to)
            }}
          />
        </Group>
      </Group>
      <Text size="xs" c="dimmed" aria-live="polite">
        {formatDate(range.from)} – {formatDate(range.to)} · {formatNumber(range.days)} ngày · so
        sánh với {formatNumber(range.days)} ngày liền trước (tối đa {MAX_RANGE_DAYS} ngày)
      </Text>
    </Stack>
  )
}
