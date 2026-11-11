import { Center, Table, UnstyledButton } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconArrowsSort } from '@tabler/icons-react'
import type { SortOrder } from '@/shared/types/sort'

interface SortableThProps<F extends string> {
  field: F
  label: string
  align?: 'right'
  sort: F
  order: SortOrder
  /** Không truyền → header chỉ hiển thị (vd. trong skeleton). */
  onSort?: (field: F) => void
}

/** Header cột sắp xếp được: nút bấm đổi chiều + `aria-sort` cho trình đọc màn hình. */
export function SortableTh<F extends string>({
  field,
  label,
  align,
  sort,
  order,
  onSort,
}: SortableThProps<F>) {
  const active = sort === field
  const Icon = !active ? IconArrowsSort : order === 'asc' ? IconArrowUp : IconArrowDown
  return (
    <Table.Th
      scope="col"
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      ta={align}
    >
      <UnstyledButton
        onClick={() => onSort?.(field)}
        disabled={!onSort}
        fw={600}
        fz="sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        {label}
        <Center c={active ? undefined : 'dimmed'} aria-hidden>
          <Icon size={14} />
        </Center>
      </UnstyledButton>
    </Table.Th>
  )
}
