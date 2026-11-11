import { z } from 'zod'
import { RECEIPT_STATUSES } from '../domain/receiptStatus'

export const RECEIPT_PAGE_SIZES = [10, 20, 50] as const

/** Filter / phân trang danh sách phiếu nhập, lưu trên URL. */
export const receiptFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  status: z.enum(['all', ...RECEIPT_STATUSES]).catch('all'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .refine((size) => (RECEIPT_PAGE_SIZES as readonly number[]).includes(size))
    .catch(RECEIPT_PAGE_SIZES[0]),
})

export type ReceiptFilters = z.infer<typeof receiptFiltersSchema>
