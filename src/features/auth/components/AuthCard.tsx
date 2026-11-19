import { Center, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconBuildingStore } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description?: ReactNode
  children: ReactNode
  /** Link phụ dưới thẻ (vd. "Đã có tài khoản? Đăng nhập"). */
  footer?: ReactNode
}

/** Khung chung cho các trang tài khoản: logo, tiêu đề, nội dung, link phụ. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Center mih="100vh" px="md" py="xl">
      <Stack w="100%" maw={440} gap="md">
        <Paper withBorder shadow="sm" radius="md" p={{ base: 'lg', sm: 'xl' }}>
          <Stack gap="lg">
            <Stack gap={6} align="center" ta="center">
              <Group gap={8} wrap="nowrap">
                <ThemeIcon variant="filled" size="lg" aria-hidden>
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <Text fw={700} size="xl">
                  SellerOps
                </Text>
              </Group>
              <Title order={1} size="h3">
                {title}
              </Title>
              {description && (
                <Text c="dimmed" size="sm">
                  {description}
                </Text>
              )}
            </Stack>
            {children}
          </Stack>
        </Paper>
        {footer && (
          <Text size="sm" ta="center" c="dimmed">
            {footer}
          </Text>
        )}
      </Stack>
    </Center>
  )
}
