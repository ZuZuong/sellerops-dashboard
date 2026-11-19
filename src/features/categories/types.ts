import type { Database } from '@/shared/types/database.types'

export type CategoryOverview =
  Database['public']['Functions']['get_category_overview']['Returns'][number]

/** Một lựa chọn danh mục cho ô Select (value = id). */
export interface CategoryOption {
  value: string
  label: string
}
