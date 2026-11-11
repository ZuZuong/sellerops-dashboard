import { Button, Chip, CloseButton, Group, Stack, TextInput } from '@mantine/core'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useSearchInput } from '@/shared/hooks/useSearchInput'
import { ORDER_STATUSES, ORDER_STATUS_META } from '../domain/orderStatus'
import type { useOrderFilters } from '../hooks/useOrderFilters'
import { orderFiltersSchema } from '../schemas/orderFilters.schema'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_META[status].label })),
]

type OrderFiltersProps = Pick<
  ReturnType<typeof useOrderFilters>,
  'filters' | 'setFilters' | 'resetFilters' | 'hasActiveFilters'
>

export function OrderFilters({
  filters,
  setFilters,
  resetFilters,
  hasActiveFilters,
}: OrderFiltersProps) {
  const [search, setSearch] = useSearchInput(filters.q, (q) => setFilters({ q }, { replace: true }))

  return (
    <Stack gap="sm" mb="md">
      <Group gap="sm" wrap="wrap">
        <TextInput
          aria-label="Tìm theo mã đơn, tên hoặc SĐT khách"
          placeholder="Tìm theo mã đơn, tên hoặc SĐT khách…"
          leftSection={<IconSearch size={16} aria-hidden />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          rightSection={
            search ? (
              <CloseButton size="sm" aria-label="Xóa từ khóa" onClick={() => setSearch('')} />
            ) : null
          }
          style={{ flex: '1 1 260px' }}
        />
        {hasActiveFilters && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={16} aria-hidden />}
            onClick={resetFilters}
          >
            Xóa bộ lọc
          </Button>
        )}
      </Group>
      <Chip.Group
        multiple={false}
        value={filters.status}
        onChange={(value) => {
          const status = orderFiltersSchema.shape.status.safeParse(value)
          if (status.success) setFilters({ status: status.data })
        }}
      >
        <Group gap="xs" wrap="wrap" role="radiogroup" aria-label="Lọc theo trạng thái">
          {STATUS_OPTIONS.map((option) => (
            <Chip key={option.value} value={option.value} size="sm" variant="light">
              {option.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Stack>
  )
}
