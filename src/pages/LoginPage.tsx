import { Center, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconBuildingStore } from '@tabler/icons-react'
import { LoginForm } from '@/features/auth'

export default function LoginPage() {
  return (
    <Center mih="100vh" px="md" py="xl">
      <Paper withBorder shadow="sm" radius="md" p={{ base: 'lg', sm: 'xl' }} w="100%" maw={400}>
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
              Đăng nhập
            </Title>
            <Text c="dimmed" size="sm">
              Quản lý sản phẩm, đơn hàng và tồn kho của cửa hàng.
            </Text>
          </Stack>
          <LoginForm />
        </Stack>
      </Paper>
    </Center>
  )
}
