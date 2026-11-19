import { Badge, Center, Paper, Stack, Text, Title } from '@mantine/core'
import { SignOutButton, useAccount } from '@/features/auth'

/** Trang tạm cho admin — Admin Console đầy đủ được xây ở Phase 3. */
export default function AdminHomePage() {
  const account = useAccount()
  return (
    <Center mih="100vh" px="md">
      <Paper withBorder radius="md" p="xl" maw={480} w="100%">
        <Stack align="center" ta="center" gap="sm">
          <Badge variant="light">Quản trị nền tảng</Badge>
          <Title order={1} size="h3">
            Admin Console
          </Title>
          <Text size="sm" c="dimmed">
            Đăng nhập với {account.data?.email}. Các trang quản lý tài khoản, duyệt hồ sơ và xem
            shop đang được xây dựng.
          </Text>
          <SignOutButton />
        </Stack>
      </Paper>
    </Center>
  )
}
