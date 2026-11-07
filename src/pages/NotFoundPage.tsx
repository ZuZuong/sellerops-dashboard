import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'

export default function NotFoundPage() {
  return (
    <Center mih="70vh" px="md">
      <Stack align="center" gap="sm" ta="center">
        <Title order={1}>404</Title>
        <Text c="dimmed">Trang bạn tìm không tồn tại hoặc đã bị di chuyển.</Text>
        <Button component={Link} to={ROUTES.dashboard}>
          Về trang tổng quan
        </Button>
      </Stack>
    </Center>
  )
}
