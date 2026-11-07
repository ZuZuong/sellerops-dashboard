import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { isRouteErrorResponse, useRouteError } from 'react-router'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Đã có lỗi không mong muốn xảy ra.'

  return (
    <Center mih="70vh" px="md">
      <Stack align="center" gap="sm" ta="center" role="alert">
        <Title order={2}>Có lỗi xảy ra</Title>
        <Text c="dimmed">{message}</Text>
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
      </Stack>
    </Center>
  )
}
