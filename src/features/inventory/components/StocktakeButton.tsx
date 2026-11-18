import { Button } from '@mantine/core'
import { IconClipboardList } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'

/** Mở biên bản kiểm kê (Mẫu 05-VT) để in / tải Excel khi kiểm tồn thực tế. */
export function StocktakeButton() {
  return (
    <Button
      component={Link}
      to={ROUTES.inventoryStocktake}
      variant="default"
      leftSection={<IconClipboardList size={16} aria-hidden />}
    >
      Xuất biên bản kiểm kê
    </Button>
  )
}
