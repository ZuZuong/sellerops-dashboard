import { Center, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { SignOutButton } from './SignOutButton'

interface BlockedScreenProps {
  icon: ReactNode
  color: string
  title: string
  children: ReactNode
  actions?: ReactNode
}

/** Màn hình toàn trang khi người dùng không vào được app (tài khoản khóa, không có quyền…). */
export function BlockedScreen({ icon, color, title, children, actions }: BlockedScreenProps) {
  return (
    <Center mih="100vh" px="md" py="xl">
      <Paper withBorder radius="md" p={{ base: 'lg', sm: 'xl' }} w="100%" maw={480} role="alert">
        <Stack gap="md" align="center" ta="center">
          <ThemeIcon size={56} radius="xl" variant="light" color={color} aria-hidden>
            {icon}
          </ThemeIcon>
          <Title order={1} size="h3">
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {children}
          </Text>
          <Group justify="center" gap="sm">
            {actions}
            <SignOutButton />
          </Group>
        </Stack>
      </Paper>
    </Center>
  )
}
