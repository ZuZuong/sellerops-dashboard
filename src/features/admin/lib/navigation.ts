import {
  IconBuildingStore,
  IconChecklist,
  IconHistory,
  IconLayoutDashboard,
  IconTrashX,
  IconUsers,
  type Icon,
} from '@tabler/icons-react'
import { ROUTES } from '@/shared/constants/routes'

/** Các trang của Admin Console — dùng chung cho thanh bên và tìm kiếm nhanh (Ctrl+K). */
export interface AdminPage {
  label: string
  description: string
  to: string
  icon: Icon
}

export const ADMIN_PAGES: readonly AdminPage[] = [
  {
    label: 'Tổng quan',
    description: 'Số liệu toàn nền tảng',
    to: ROUTES.admin,
    icon: IconLayoutDashboard,
  },
  {
    label: 'Duyệt hồ sơ',
    description: 'Hàng đợi hồ sơ chờ duyệt',
    to: ROUTES.adminApprovals,
    icon: IconChecklist,
  },
  {
    label: 'Tài khoản',
    description: 'Khóa, mở khóa, xóa tài khoản',
    to: ROUTES.adminAccounts,
    icon: IconUsers,
  },
  {
    label: 'Shop',
    description: 'Danh sách shop, tạm khóa shop',
    to: ROUTES.adminSellers,
    icon: IconBuildingStore,
  },
  {
    label: 'Chờ xóa',
    description: 'Tài khoản đã xóa, chờ xác nhận',
    to: ROUTES.adminDeletions,
    icon: IconTrashX,
  },
  {
    label: 'Nhật ký',
    description: 'Hành động của quản trị viên',
    to: ROUTES.adminAuditLog,
    icon: IconHistory,
  },
]
