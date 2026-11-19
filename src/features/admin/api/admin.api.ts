import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { sanitizeFileName } from '@/shared/lib/fileName'
import { supabase } from '@/shared/lib/supabase'
import type {
  AccountFilters,
  AuditFilters,
  DeletionFilters,
  SellerFilters,
} from '../schemas/adminFilters.schema'
import type {
  AccountDeletion,
  AdminAccount,
  AdminSeller,
  AdminSellerDetail,
  AuditLogEntry,
  DeletionEvidence,
  Paged,
  PlatformRevenuePoint,
  PlatformStats,
  SellerDocument,
} from '../types'

/*
 * Mọi hàm đọc / ghi của admin đi qua RPC SECURITY DEFINER có `require_admin()` bên trong:
 * người không phải admin gọi thẳng API cũng bị từ chối (NOT_ADMIN). Admin KHÔNG ghi trực tiếp
 * dữ liệu kinh doanh của seller; mọi hành động đều ghi audit_logs trong cùng transaction.
 */

export const SELLER_DOCUMENTS_BUCKET = 'seller-documents'
export const EVIDENCE_BUCKET = 'violation-evidence'
/** Signed URL hết hạn nhanh: link lộ ra ngoài cũng không dùng lại được lâu. */
const SIGNED_URL_TTL_SECONDS = 60

export const EVIDENCE_UPLOAD_FAILED = 'EVIDENCE_UPLOAD_FAILED'

/** `total_count` lặp ở mỗi dòng (window function) → tổng số dòng của mọi trang. */
function paged<T extends { total_count: number }>(rows: T[]): Paged<T> {
  return { items: rows, total: rows[0]?.total_count ?? 0 }
}

const orNull = <T extends string>(value: T | 'all' | ''): T | undefined =>
  value === 'all' || value === '' ? undefined : value

// -----------------------------------------------------------------------------
// Đọc
// -----------------------------------------------------------------------------

export async function fetchPlatformStats(days: number): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc('admin_platform_stats', { p_days: days }).single()
  if (error) throw error
  return data
}

export async function fetchPlatformRevenue(days: number): Promise<PlatformRevenuePoint[]> {
  const { data, error } = await supabase.rpc('admin_revenue_series', { p_days: days })
  if (error) throw error
  return data
}

export async function fetchAccounts(filters: AccountFilters): Promise<Paged<AdminAccount>> {
  const state = filters.state
  // "Hoạt động" = chưa xóa và không khóa; "Bị khóa" = chưa xóa nhưng đang khóa.
  const notDeleted = state === 'active' || state === 'locked'
  const { data, error } = await supabase.rpc('admin_list_accounts', {
    p_q: filters.q || undefined,
    p_role: orNull(filters.role),
    p_locked: notDeleted ? state === 'locked' : undefined,
    p_account_status: notDeleted ? 'active' : orNull(state),
    p_page: filters.page,
    p_page_size: filters.pageSize,
  })
  if (error) throw error
  return paged(data)
}

export async function fetchSellers(filters: SellerFilters): Promise<Paged<AdminSeller>> {
  const { data, error } = await supabase.rpc('admin_list_sellers', {
    p_q: filters.q || undefined,
    p_status: orNull(filters.status),
    p_page: filters.page,
    p_page_size: filters.pageSize,
  })
  if (error) throw error
  return paged(data)
}

export async function fetchSellerDetail(sellerId: string): Promise<AdminSellerDetail | null> {
  const { data, error } = await supabase
    .rpc('admin_get_seller', { p_seller_id: sellerId })
    .maybeSingle()
  if (error) {
    if (error.message === 'SELLER_NOT_FOUND') return null
    throw error
  }
  return data
}

/** Giấy tờ đăng ký kinh doanh của shop (RLS: admin đọc mọi shop). */
export async function fetchSellerDocuments(sellerId: string): Promise<SellerDocument[]> {
  const { data, error } = await supabase
    .from('seller_documents')
    .select('id, kind, storage_path, file_name, mime_type, file_size, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchAuditLogs(
  filters: AuditFilters & { targetIds?: readonly string[] },
): Promise<Paged<AuditLogEntry>> {
  const { data, error } = await supabase.rpc('admin_list_audit_logs', {
    p_actor_id: filters.actor || undefined,
    p_action: filters.action || undefined,
    p_from: filters.from || undefined,
    p_to: filters.to || undefined,
    p_target_ids: filters.targetIds ? [...filters.targetIds] : undefined,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  })
  if (error) throw error
  return paged(data)
}

export async function fetchDeletions(filters: DeletionFilters): Promise<Paged<AccountDeletion>> {
  const { data, error } = await supabase.rpc('admin_list_account_deletions', {
    p_status: orNull(filters.status),
    p_q: filters.q || undefined,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  })
  if (error) throw error
  return paged(data)
}

export async function fetchDeletionEvidence(deletionId: string): Promise<DeletionEvidence[]> {
  const { data, error } = await supabase
    .from('account_deletion_evidence')
    .select('id, storage_path, file_name, mime_type, file_size, created_at')
    .eq('deletion_id', deletionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/** Link xem file trong bucket riêng tư (giấy tờ seller / bằng chứng vi phạm). */
export async function createSignedFileUrl(
  bucket: typeof SELLER_DOCUMENTS_BUCKET | typeof EVIDENCE_BUCKET,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

// -----------------------------------------------------------------------------
// Hành động (RPC ghi audit_logs)
// -----------------------------------------------------------------------------

export async function reviewSeller(
  sellerId: string,
  decision: 'approved' | 'rejected',
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('review_seller', {
    p_seller_id: sellerId,
    p_decision: decision,
    p_reason: reason || undefined,
  })
  if (error) throw error
}

export async function setSellerSuspended(
  sellerId: string,
  suspended: boolean,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_seller_suspended', {
    p_seller_id: sellerId,
    p_suspended: suspended,
    p_reason: reason || undefined,
  })
  if (error) throw error
}

export async function setAccountLocked(
  userId: string,
  locked: boolean,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_account_locked', {
    p_user_id: userId,
    p_locked: locked,
    p_reason: reason || undefined,
  })
  if (error) throw error
}

interface UploadedEvidence {
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
}

async function uploadEvidence(userId: string, files: readonly File[]): Promise<UploadedEvidence[]> {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      const path = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
      const { error } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw new Error(EVIDENCE_UPLOAD_FAILED, { cause: error })
      return {
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      }
    }),
  )
  const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  if (uploaded.length !== files.length) {
    await removeEvidence(uploaded.map((item) => item.storage_path))
    throw new Error(EVIDENCE_UPLOAD_FAILED)
  }
  return uploaded
}

/** Dọn file chưa gắn vào hồ sơ (policy chỉ cho xóa file chưa nộp). Không ném lỗi. */
async function removeEvidence(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return
  await supabase.storage.from(EVIDENCE_BUCKET).remove([...paths])
}

/**
 * Xóa (mềm) tài khoản: tải bằng chứng lên bucket riêng tư → RPC khóa tài khoản + tạo hồ sơ
 * "chờ xác nhận xóa" trong MỘT transaction. RPC lỗi → xóa các file vừa tải.
 * Trả về id hồ sơ xóa.
 */
export async function requestAccountDeletion(
  userId: string,
  reason: string,
  evidence: readonly File[],
): Promise<string> {
  const uploaded = await uploadEvidence(userId, evidence)
  const { data, error } = await supabase.rpc('request_account_deletion', {
    p_user_id: userId,
    p_reason: reason,
    p_evidence: uploaded.map((item) => ({ ...item })),
  })
  if (error) {
    await removeEvidence(uploaded.map((item) => item.storage_path))
    throw error
  }
  return data
}

/**
 * Gửi email thông báo xóa tài khoản qua Edge Function `notify-account-deletion`. Function tự đọc
 * người nhận + nội dung từ database (chỉ admin gọi được); client chỉ gửi id hồ sơ.
 */
export async function notifyAccountDeletion(deletionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('notify-account-deletion', {
    body: { deletion_id: deletionId },
  })
  if (!error) return

  let code = 'EMAIL_SEND_FAILED'
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    const body: unknown = await response.json().catch(() => null)
    code =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : response.status === 404
          ? 'EMAIL_FUNCTION_NOT_DEPLOYED'
          : 'EMAIL_SEND_FAILED'
  } else if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    code = 'EMAIL_FUNCTION_UNREACHABLE'
  }

  // Function không chạy tới bước ghi kết quả (chưa deploy, mạng, CORS…) → tự ghi lỗi vào hồ sơ
  // để trang "Chờ xóa" hiện "Gửi lỗi" kèm lý do. Không ghi đè lỗi function đã ghi.
  if (code === 'EMAIL_FUNCTION_NOT_DEPLOYED' || code === 'EMAIL_FUNCTION_UNREACHABLE') {
    await supabase.rpc('mark_deletion_notified', { p_deletion_id: deletionId, p_error: code })
  }
  throw new Error(code, { cause: error })
}

export async function confirmAccountDeletion(deletionId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_account_deletion', { p_deletion_id: deletionId })
  if (error) throw error
}

export async function restoreAccount(deletionId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('restore_account', {
    p_deletion_id: deletionId,
    p_note: note || undefined,
  })
  if (error) throw error
}
