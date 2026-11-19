import { Badge, Box, Checkbox, Group, List, Paper, Stack, Text, Title } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { isScrolledToBottom } from '../lib/scroll'
import { canConfirmTerms } from '../schemas/application.schema'
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from '../terms'
import { StepFooter } from './StepFooter'

interface TermsStepProps {
  submitting: boolean
  onBack: () => void
  onSubmit: () => void
}

/**
 * Bước 4 — cam kết và nội quy. Nút "Xác nhận tuân thủ" chỉ bật khi seller đã cuộn hết văn bản
 * VÀ tick đồng ý. Database ghi lại phiên bản cam kết và thời điểm chấp nhận khi gửi hồ sơ.
 */
export function TermsStep({ submitting, onBack, onSubmit }: TermsStepProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const checkScroll = () => {
    const viewport = viewportRef.current
    if (viewport && isScrolledToBottom(viewport)) setScrolledToEnd(true)
  }

  // Màn hình cao, văn bản không cần cuộn → coi như đã đọc hết ngay.
  useEffect(checkScroll, [])

  const canConfirm = canConfirmTerms({ scrolledToEnd, accepted })

  return (
    <Stack gap="md">
      <Group justify="space-between" gap="xs">
        <Text size="sm" c="dimmed">
          Vui lòng đọc kỹ toàn bộ văn bản trước khi xác nhận và gửi hồ sơ.
        </Text>
        <Badge variant="light" color="gray">
          Phiên bản {TERMS_VERSION}
        </Badge>
      </Group>
      <Paper withBorder radius="md">
        <Box
          ref={viewportRef}
          onScroll={checkScroll}
          h={320}
          p="md"
          tabIndex={0}
          role="region"
          aria-label="Nội dung cam kết và nội quy"
          data-testid="terms-viewport"
          style={{ overflowY: 'auto' }}
        >
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={3} size="h4" ta="center">
                {TERMS_TITLE}
              </Title>
              <Text size="sm" c="dimmed">
                {TERMS_INTRO}
              </Text>
            </Stack>
            {TERMS_SECTIONS.map((section) => (
              <Stack key={section.title} gap={6}>
                <Title order={4} size="h5">
                  {section.title}
                </Title>
                <List size="sm" spacing={4}>
                  {section.items.map((item) => (
                    <List.Item key={item}>{item}</List.Item>
                  ))}
                </List>
              </Stack>
            ))}
            <Text size="sm" fw={500}>
              — Hết văn bản —
            </Text>
          </Stack>
        </Box>
      </Paper>
      {!scrolledToEnd && (
        <Text size="sm" c="dimmed" aria-live="polite">
          Cuộn tới cuối văn bản để có thể xác nhận.
        </Text>
      )}
      <Checkbox
        label="Tôi đã đọc, hiểu và đồng ý tuân thủ Cam kết và Nội quy dành cho Người bán."
        checked={accepted}
        onChange={(event) => setAccepted(event.currentTarget.checked)}
      />
      <StepFooter
        onBack={onBack}
        onNext={onSubmit}
        nextLabel="Xác nhận tuân thủ và gửi hồ sơ"
        nextDisabled={!canConfirm}
        loading={submitting}
      />
    </Stack>
  )
}
