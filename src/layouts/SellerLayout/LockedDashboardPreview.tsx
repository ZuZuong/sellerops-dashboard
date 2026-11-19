import { SimpleGrid, Skeleton, Stack } from '@mantine/core'

/** Khung dashboard tĩnh phía sau modal khi shop chưa được duyệt (không tải dữ liệu thật). */
export function LockedDashboardPreview() {
  return (
    <Stack gap="md" aria-hidden>
      <Skeleton height={32} width="40%" radius="md" animate={false} />
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={96} radius="md" animate={false} />
        ))}
      </SimpleGrid>
      <Skeleton height={280} radius="md" animate={false} />
    </Stack>
  )
}
