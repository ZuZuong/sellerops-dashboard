import { Center, Loader } from '@mantine/core'

export function PageLoader() {
  return (
    <Center h="60vh" role="status" aria-label="Đang tải trang">
      <Loader />
    </Center>
  )
}
