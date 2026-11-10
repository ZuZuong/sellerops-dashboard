import { Group, Paper, Title } from '@mantine/core'
import { useId, type ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { ErrorState } from './ErrorState'

interface WidgetCardProps {
  title: string
  /** Nội dung góc phải tiêu đề (bộ lọc, link "Xem tất cả"...). */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Khung chung cho một widget độc lập: tiêu đề + nội dung được bọc ErrorBoundary riêng,
 * nên một widget lỗi không làm hỏng các widget khác.
 */
export function WidgetCard({ title, actions, children }: WidgetCardProps) {
  const titleId = useId()
  return (
    <Paper component="section" aria-labelledby={titleId} withBorder p="md" radius="md" h="100%">
      <Group justify="space-between" align="center" gap="sm" mb="md" wrap="wrap">
        <Title order={3} size="h5" id={titleId}>
          {title}
        </Title>
        {actions}
      </Group>
      <ErrorBoundary
        fallback={({ reset }) => (
          <ErrorState message="Không hiển thị được nội dung này." onRetry={reset} />
        )}
      >
        {children}
      </ErrorBoundary>
    </Paper>
  )
}
