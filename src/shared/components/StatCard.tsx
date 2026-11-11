import { Group, Paper, SimpleGrid, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { formatPercentChange } from '@/shared/lib/formatters'
import { getTrend, type Trend } from '@/shared/lib/metrics'

/** Lưới thẻ số liệu: 1 cột (mobile) → 2 cột → 4 cột (desktop). */
export function StatGrid({ children, ...rest }: { children: ReactNode; 'aria-busy'?: boolean }) {
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md" {...rest}>
      {children}
    </SimpleGrid>
  )
}

interface StatCardProps {
  label: string
  value: string
  icon: ReactNode
  color: string
  footer?: ReactNode
}

/** Thẻ một con số chính (KPI): nhãn, giá trị, icon và dòng phụ (so sánh kỳ trước, link...). */
export function StatCard({ label, value, icon, color, footer }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} miw={0}>
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text fz={24} fw={700} lh={1.2} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Text>
        </Stack>
        <ThemeIcon variant="light" color={color} size={38} radius="md" aria-hidden>
          {icon}
        </ThemeIcon>
      </Group>
      {footer && (
        <Group mt="sm" gap={4}>
          {footer}
        </Group>
      )}
    </Paper>
  )
}

export function StatCardSkeleton({ testId }: { testId?: string }) {
  return (
    <Paper withBorder p="md" radius="md" data-testid={testId}>
      <Skeleton height={14} width="50%" mb="md" />
      <Skeleton height={28} width="70%" mb="sm" />
      <Skeleton height={12} width="60%" />
    </Paper>
  )
}

// Màu chỉ bổ trợ: dấu +/- của phần trăm và icon mũi tên mới là thông tin chính (không dựa vào màu).
const TREND_META: Record<Trend, { color: string; icon: ReactNode }> = {
  up: { color: 'teal', icon: <IconArrowUpRight size={14} /> },
  down: { color: 'red', icon: <IconArrowDownRight size={14} /> },
  flat: { color: 'dimmed', icon: <IconMinus size={14} /> },
}

interface ChangeIndicatorProps {
  /** Tỉ lệ thay đổi (0.25 = +25%); null = không có mốc so sánh. */
  change: number | null
  suffix: string
  /** Chỉ số mà tăng là xấu (vd. số đơn hủy) → đảo màu tăng/giảm. */
  invert?: boolean
}

export function ChangeIndicator({ change, suffix, invert = false }: ChangeIndicatorProps) {
  const trend = getTrend(change)
  if (change === null || trend === null) {
    return (
      <Text size="xs" c="dimmed">
        Chưa có dữ liệu kỳ trước
      </Text>
    )
  }
  const meta = TREND_META[trend]
  const color =
    invert && trend !== 'flat' ? TREND_META[trend === 'up' ? 'down' : 'up'].color : meta.color
  return (
    <Text size="xs" c="dimmed" component="span">
      <Text
        component="span"
        size="xs"
        fw={600}
        c={color}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 2, verticalAlign: 'middle' }}
      >
        <span aria-hidden>{meta.icon}</span>
        {formatPercentChange(change)}
      </Text>{' '}
      {suffix}
    </Text>
  )
}
