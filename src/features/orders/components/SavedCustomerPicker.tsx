import { Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { RemoteSearchSelect } from '@/shared/components/RemoteSearchSelect'
import { useRemoteSearch } from '@/shared/hooks/useRemoteSearch'
import { useSavedCustomers } from '../api/orders.queries'
import type { SavedCustomer } from '../types'

const getKey = (customer: SavedCustomer) => customer.id
const getLabel = (customer: SavedCustomer) => `${customer.name} · ${customer.phone}`

/**
 * Chọn khách đã lưu (tìm theo tên / SĐT phía server) để điền sẵn tên, SĐT, địa chỉ và phương thức
 * thanh toán. Không thuộc dữ liệu form — chỉ là lối tắt nhập liệu, các ô vẫn sửa được sau đó.
 */
export function SavedCustomerPicker({ onSelect }: { onSelect: (customer: SavedCustomer) => void }) {
  const [value, setValue] = useState<SavedCustomer | null>(null)
  const search = useRemoteSearch(value ? getLabel(value) : null)
  const customers = useSavedCustomers(search.term, search.activated)

  return (
    <RemoteSearchSelect
      label="Khách đã lưu"
      placeholder="Tìm khách quen theo tên hoặc SĐT…"
      value={value}
      onChange={(customer) => {
        setValue(customer)
        if (customer) onSelect(customer)
      }}
      search={search}
      items={customers.data}
      loading={customers.isFetching}
      failed={customers.isError}
      getKey={getKey}
      getLabel={getLabel}
      renderOption={(customer) => (
        <Stack gap={0}>
          <Text size="sm">
            {customer.name} · {customer.phone}
          </Text>
          {customer.address && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {customer.address}
            </Text>
          )}
        </Stack>
      )}
    />
  )
}
