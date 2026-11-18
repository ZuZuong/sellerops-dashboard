import { Button } from '@mantine/core'
import { IconReportMoney } from '@tabler/icons-react'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'

/** Mở bảng kê doanh thu cho đúng kỳ đang xem (giữ nguyên tham số khoảng ngày trên URL). */
export function RevenueReportButton() {
  const { search } = useLocation()
  return (
    <Button
      component={Link}
      to={`${ROUTES.analyticsRevenueReport}${search}`}
      variant="default"
      leftSection={<IconReportMoney size={16} aria-hidden />}
    >
      Xuất bảng kê doanh thu
    </Button>
  )
}
