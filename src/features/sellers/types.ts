import type { Tables } from '@/shared/types/database.types'

/** Shop (hồ sơ kinh doanh + trạng thái duyệt). Mọi thay đổi đi qua RPC, client chỉ đọc. */
export type Seller = Tables<'sellers'>
