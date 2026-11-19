import { Button, Group } from '@mantine/core'
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface StepFooterProps {
  onBack?: () => void
  /** Không truyền `onNext` → nút chính là submit của form chứa nó. */
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  extra?: ReactNode
}

/** Thanh nút cuối mỗi bước: Quay lại / (nút phụ) / Tiếp tục. */
export function StepFooter({
  onBack,
  onNext,
  nextLabel = 'Lưu và tiếp tục',
  nextDisabled = false,
  loading = false,
  extra,
}: StepFooterProps) {
  return (
    <Group justify="space-between" mt="lg" gap="sm" wrap="wrap-reverse">
      {onBack ? (
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} aria-hidden />}
          onClick={onBack}
          disabled={loading}
        >
          Quay lại
        </Button>
      ) : (
        <span />
      )}
      <Group gap="sm" wrap="wrap">
        {extra}
        <Button
          type={onNext ? 'button' : 'submit'}
          onClick={onNext}
          disabled={nextDisabled}
          loading={loading}
          rightSection={<IconArrowRight size={16} aria-hidden />}
        >
          {nextLabel}
        </Button>
      </Group>
    </Group>
  )
}
