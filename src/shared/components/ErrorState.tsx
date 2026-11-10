import { Button, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
}

export function ErrorState({
  title = 'Không tải được dữ liệu',
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <Stack align="center" justify="center" gap="xs" py="xl" ta="center" role="alert">
      <ThemeIcon size={44} radius="xl" variant="light" color="red" aria-hidden>
        <IconAlertTriangle size={24} stroke={1.5} />
      </ThemeIcon>
      <Text fw={500}>{title}</Text>
      <Text size="sm" c="dimmed" maw={360}>
        {message}
      </Text>
      {onRetry && (
        <Button
          variant="light"
          size="xs"
          leftSection={<IconRefresh size={14} />}
          onClick={onRetry}
          loading={retrying}
        >
          Thử lại
        </Button>
      )}
    </Stack>
  )
}
