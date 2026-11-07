import {
  IconBox,
  IconBuildingWarehouse,
  IconChartBar,
  IconLayoutDashboard,
  IconShoppingCart,
  type Icon,
} from '@tabler/icons-react'
import { ROUTES } from '@/shared/constants/routes'

export interface NavItem {
  label: string
  to: string
  icon: Icon
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Tổng quan', to: ROUTES.dashboard, icon: IconLayoutDashboard },
  { label: 'Sản phẩm', to: ROUTES.products, icon: IconBox },
  { label: 'Đơn hàng', to: ROUTES.orders, icon: IconShoppingCart },
  { label: 'Kho hàng', to: ROUTES.inventory, icon: IconBuildingWarehouse },
  { label: 'Phân tích', to: ROUTES.analytics, icon: IconChartBar },
]
