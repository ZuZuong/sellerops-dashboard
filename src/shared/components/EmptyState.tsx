import { Stack, Text, ThemeIcon } from '@mantine/core'
import { IconInbox } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  /** Hành động gợi ý tiếp theo (vd. nút "Tạo đơn hàng"). */
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" gap="xs" py="xl" ta="center">
      <ThemeIcon size={44} radius="xl" variant="light" color="gray" aria-hidden>
        {icon ?? <IconInbox size={24} stroke={1.5} />}
      </ThemeIcon>
      <Text fw={500}>{title}</Text>
      {description && (
        <Text size="sm" c="dimmed" maw={360}>
          {description}
        </Text>
      )}
      {action}
    </Stack>
  )
}
