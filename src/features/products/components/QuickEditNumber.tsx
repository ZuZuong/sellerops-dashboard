import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Popover,
  Stack,
  UnstyledButton,
} from '@mantine/core'
import { IconPencil } from '@tabler/icons-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { z } from 'zod'

interface QuickEditNumberProps {
  value: number
  /** Nội dung hiển thị của ô (giá đã format, số tồn kho kèm badge...). */
  display: ReactNode
  /** Nhãn của ô nhập, cũng dùng cho aria-label của nút mở. */
  label: string
  schema: z.ZodType<number>
  suffix?: string
  disabled?: boolean
  onSave: (value: number) => void
}

/** Ô sửa nhanh một giá trị số ngay trên bảng (popover + validate bằng Zod). */
export function QuickEditNumber({
  value,
  display,
  label,
  schema,
  suffix,
  disabled = false,
  onSave,
}: QuickEditNumberProps) {
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState<number | string>(value)
  const [error, setError] = useState<string | null>(null)

  const open = () => {
    setDraft(value)
    setError(null)
    setOpened(true)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = schema.safeParse(typeof draft === 'number' ? draft : undefined)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Giá trị không hợp lệ')
      return
    }
    setOpened(false)
    if (parsed.data !== value) onSave(parsed.data)
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow trapFocus>
      <Popover.Target>
        <UnstyledButton
          onClick={open}
          disabled={disabled}
          aria-label={label}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {display}
          {!disabled && (
            <ActionIcon component="span" variant="subtle" color="gray" size="sm" aria-hidden>
              <IconPencil size={14} />
            </ActionIcon>
          )}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="xs" w={220}>
            <NumberInput
              label={label}
              value={draft}
              onChange={(next) => {
                setDraft(next)
                setError(null)
              }}
              error={error}
              min={0}
              allowNegative={false}
              allowLeadingZeros={false}
              allowDecimal={false}
              thousandSeparator="."
              decimalSeparator=","
              suffix={suffix}
              data-autofocus
            />
            <Group justify="flex-end" gap="xs">
              <Button variant="default" size="xs" onClick={() => setOpened(false)}>
                Hủy
              </Button>
              <Button type="submit" size="xs">
                Lưu
              </Button>
            </Group>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  )
}
