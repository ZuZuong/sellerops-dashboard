import { Badge, Button } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { formatNumber } from '@/shared/lib/formatters'
import { useProductTrashCount } from '../api/products.queries'

/** Nút "Thùng rác" trên trang Sản phẩm, kèm số sản phẩm đang chờ xóa vĩnh viễn. */
export function ProductTrashButton() {
  const count = useProductTrashCount()
  const value = count.data ?? 0
  return (
    <Button
      component={Link}
      to={ROUTES.productTrash}
      variant="subtle"
      leftSection={<IconTrash size={16} aria-hidden />}
      rightSection={
        value > 0 ? (
          <Badge size="sm" variant="light" color="gray" circle={value < 10}>
            {formatNumber(value)}
          </Badge>
        ) : null
      }
    >
      Thùng rác
    </Button>
  )
}
