import type { Database, Enums, Tables } from '@/shared/types/database.types'

type Fn<Name extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][Name]['Returns']

type Row<T> = T extends readonly (infer R)[] ? R : never

export type AccountStatus = Enums<'account_status'>
export type DeletionStatus = Enums<'account_deletion_status'>
export type SellerStatus = Enums<'seller_status'>
export type UserRole = Enums<'user_role'>

/** Hàm trả về `total_count` lặp ở mỗi dòng (window) → client tách thành { items, total }. */
export interface Paged<T> {
  items: T[]
  total: number
}

export type PlatformStats = Row<Fn<'admin_platform_stats'>>
export type PlatformRevenuePoint = Row<Fn<'admin_revenue_series'>>
export type AdminAccount = Row<Fn<'admin_list_accounts'>>
export type AdminSeller = Row<Fn<'admin_list_sellers'>>
export type AdminSellerDetail = Row<Fn<'admin_get_seller'>>
export type AuditLogEntry = Row<Fn<'admin_list_audit_logs'>>
export type AccountDeletion = Row<Fn<'admin_list_account_deletions'>>

export type SellerDocument = Pick<
  Tables<'seller_documents'>,
  'id' | 'kind' | 'storage_path' | 'file_name' | 'mime_type' | 'file_size' | 'created_at'
>

export type DeletionEvidence = Pick<
  Tables<'account_deletion_evidence'>,
  'id' | 'storage_path' | 'file_name' | 'mime_type' | 'file_size' | 'created_at'
>

/** Đối tượng bị xóa tài khoản (từ bảng tài khoản hoặc bảng seller). */
export interface DeletionTarget {
  userId: string
  email: string
  shopName: string | null
}
