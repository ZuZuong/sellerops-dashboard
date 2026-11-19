import { notifications } from '@mantine/notifications'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { change, withChanges } from '@/shared/lib/activityChanges'
import { formatNumber } from '@/shared/lib/formatters'
import { getAdminErrorMessage } from '../lib/adminErrors'
import type {
  AccountFilters,
  AuditFilters,
  DeletionFilters,
  SellerFilters,
} from '../schemas/adminFilters.schema'
import type { DeletionTarget } from '../types'
import {
  confirmAccountDeletion,
  createSignedFileUrl,
  fetchAccounts,
  fetchAuditLogs,
  fetchDeletionEvidence,
  fetchDeletions,
  fetchPlatformRevenue,
  fetchPlatformStats,
  fetchSellerDetail,
  fetchSellerDocuments,
  fetchSellers,
  notifyAccountDeletion,
  requestAccountDeletion,
  restoreAccount,
  reviewSeller,
  setAccountLocked,
  setSellerSuspended,
  type EVIDENCE_BUCKET,
  type SELLER_DOCUMENTS_BUCKET,
} from './admin.api'

export const adminKeys = {
  all: ['admin'] as const,
  stats: (days: number) => [...adminKeys.all, 'stats', days] as const,
  revenue: (days: number) => [...adminKeys.all, 'revenue', days] as const,
  accounts: (filters: AccountFilters) => [...adminKeys.all, 'accounts', filters] as const,
  sellers: (filters: SellerFilters) => [...adminKeys.all, 'sellers', filters] as const,
  seller: (sellerId: string) => [...adminKeys.all, 'seller', sellerId] as const,
  documents: (sellerId: string) => [...adminKeys.all, 'documents', sellerId] as const,
  audit: (filters: AuditFilters & { targetIds?: readonly string[] }) =>
    [...adminKeys.all, 'audit', filters] as const,
  deletions: (filters: DeletionFilters) => [...adminKeys.all, 'deletions', filters] as const,
  evidence: (deletionId: string) => [...adminKeys.all, 'evidence', deletionId] as const,
}

const list = { placeholderData: keepPreviousData }

export const usePlatformStats = (days: number) =>
  useQuery({ queryKey: adminKeys.stats(days), queryFn: () => fetchPlatformStats(days) })

export const usePlatformRevenue = (days: number) =>
  useQuery({
    queryKey: adminKeys.revenue(days),
    queryFn: () => fetchPlatformRevenue(days),
    ...list,
  })

export const useAdminAccounts = (filters: AccountFilters) =>
  useQuery({
    queryKey: adminKeys.accounts(filters),
    queryFn: () => fetchAccounts(filters),
    ...list,
  })

export const useAdminSellers = (filters: SellerFilters, enabled = true) =>
  useQuery({
    queryKey: adminKeys.sellers(filters),
    queryFn: () => fetchSellers(filters),
    enabled,
    ...list,
  })

export const useAdminSeller = (sellerId: string, enabled = true) =>
  useQuery({
    queryKey: adminKeys.seller(sellerId),
    queryFn: () => fetchSellerDetail(sellerId),
    enabled,
  })

export const useSellerDocuments = (sellerId: string) =>
  useQuery({
    queryKey: adminKeys.documents(sellerId),
    queryFn: () => fetchSellerDocuments(sellerId),
  })

export const useAuditLogs = (filters: AuditFilters & { targetIds?: readonly string[] }) =>
  useQuery({ queryKey: adminKeys.audit(filters), queryFn: () => fetchAuditLogs(filters), ...list })

export const useAccountDeletions = (filters: DeletionFilters) =>
  useQuery({
    queryKey: adminKeys.deletions(filters),
    queryFn: () => fetchDeletions(filters),
    ...list,
  })

export const useDeletionEvidence = (deletionId: string | null) =>
  useQuery({
    queryKey: adminKeys.evidence(deletionId ?? ''),
    queryFn: () => fetchDeletionEvidence(deletionId ?? ''),
    enabled: deletionId !== null,
  })

// -----------------------------------------------------------------------------
// Hành động
// -----------------------------------------------------------------------------

/** Mọi số liệu admin có thể đổi sau một hành động → làm mới toàn bộ nhánh `admin`. */
const refreshAdmin = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: adminKeys.all })

function notifyError(title: string, error: unknown) {
  notifications.show({ color: 'red', title, message: getAdminErrorMessage(error) })
}

interface SellerActionTarget {
  sellerId: string
  shopName: string | null
}

const shopLabel = (shopName: string | null) => shopName ?? 'Shop chưa đặt tên'

export function useReviewSeller() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sellerId,
      decision,
      reason,
    }: SellerActionTarget & { decision: 'approved' | 'rejected'; reason: string }) =>
      reviewSeller(sellerId, decision, reason),
    onSuccess: (_data, { decision, shopName, reason }) => {
      notifications.show({
        color: decision === 'approved' ? 'green' : 'orange',
        title: decision === 'approved' ? 'Đã duyệt hồ sơ' : 'Đã từ chối hồ sơ',
        message:
          decision === 'approved'
            ? `${shopLabel(shopName)} đã được mở khóa dashboard.`
            : `${shopLabel(shopName)} · Lý do: ${reason}`,
        ...withChanges([
          change('Trạng thái', 'Chờ duyệt', decision === 'approved' ? 'Đã duyệt' : 'Bị từ chối'),
        ]),
      })
      return refreshAdmin(queryClient)
    },
    onError: (error) => notifyError('Không xử lý được hồ sơ', error),
  })
}

export function useSetSellerSuspended() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sellerId,
      suspended,
      reason,
    }: SellerActionTarget & { suspended: boolean; reason: string }) =>
      setSellerSuspended(sellerId, suspended, reason),
    onSuccess: (_data, { suspended, shopName }) => {
      notifications.show({
        color: suspended ? 'orange' : 'green',
        title: suspended ? 'Đã tạm khóa shop' : 'Đã mở khóa shop',
        message: shopLabel(shopName),
      })
      return refreshAdmin(queryClient)
    },
    onError: (error) => notifyError('Không đổi được trạng thái shop', error),
  })
}

export function useSetAccountLocked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      locked,
      reason,
    }: {
      userId: string
      email: string
      locked: boolean
      reason: string
    }) => setAccountLocked(userId, locked, reason),
    onSuccess: (_data, { locked, email }) => {
      notifications.show({
        color: locked ? 'orange' : 'green',
        title: locked ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
        message: email,
      })
      return refreshAdmin(queryClient)
    },
    onError: (error) => notifyError('Không khóa / mở khóa được tài khoản', error),
  })
}

/** Gửi (lại) email thông báo xóa tài khoản; lỗi không làm hỏng việc xóa đã thành công. */
async function sendDeletionEmail(deletionId: string, email: string): Promise<boolean> {
  try {
    await notifyAccountDeletion(deletionId)
    notifications.show({
      color: 'green',
      title: 'Đã gửi email thông báo',
      message: `Đã gửi lý do xóa và hướng dẫn khiếu nại tới ${email}.`,
    })
    return true
  } catch (error) {
    notifications.show({
      color: 'orange',
      title: 'Chưa gửi được email thông báo',
      message: `${getAdminErrorMessage(error)} Có thể gửi lại ở mục "Chờ xóa".`,
      autoClose: 10_000,
    })
    return false
  }
}

/**
 * Xóa (mềm) tài khoản: tải bằng chứng + khóa tài khoản + đưa vào hàng "chờ xác nhận xóa" (một
 * transaction), rồi gửi email thông báo. Seller đang đăng nhập bị đá ra ngay nhờ Realtime.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      target,
      reason,
      evidence,
    }: {
      target: DeletionTarget
      reason: string
      evidence: readonly File[]
    }) => {
      const deletionId = await requestAccountDeletion(target.userId, reason, evidence)
      return { deletionId }
    },
    onSuccess: async ({ deletionId }, { target, evidence }) => {
      notifications.show({
        color: 'orange',
        title: 'Đã xóa tài khoản',
        message:
          `${target.shopName ? `${target.shopName} · ` : ''}${target.email} đã bị khóa và chuyển vào mục "Chờ xóa".` +
          (evidence.length > 0 ? ` Kèm ${formatNumber(evidence.length)} file bằng chứng.` : ''),
      })
      await refreshAdmin(queryClient)
      await sendDeletionEmail(deletionId, target.email)
      await refreshAdmin(queryClient)
    },
    onError: (error) => notifyError('Không xóa được tài khoản', error),
  })
}

export function useResendDeletionEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deletionId, email }: { deletionId: string; email: string }) =>
      sendDeletionEmail(deletionId, email),
    onSettled: () => refreshAdmin(queryClient),
  })
}

export function useConfirmDeletion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deletionId }: { deletionId: string; email: string }) =>
      confirmAccountDeletion(deletionId),
    onSuccess: (_data, { email }) => {
      notifications.show({
        color: 'green',
        title: 'Đã xóa vĩnh viễn tài khoản',
        message: `${email} đã bị xóa khỏi hệ thống, email được giải phóng. Dữ liệu shop vẫn được lưu giữ.`,
      })
      return refreshAdmin(queryClient)
    },
    onError: (error) => notifyError('Không xóa vĩnh viễn được tài khoản', error),
  })
}

export function useRestoreAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ deletionId, note }: { deletionId: string; email: string; note: string }) =>
      restoreAccount(deletionId, note),
    onSuccess: (_data, { email }) => {
      notifications.show({
        color: 'green',
        title: 'Đã khôi phục tài khoản',
        message: `${email} đã được khôi phục về trạng thái trước khi bị xóa.`,
      })
      return refreshAdmin(queryClient)
    },
    onError: (error) => notifyError('Không khôi phục được tài khoản', error),
  })
}

/**
 * Mở file trong bucket riêng tư bằng signed URL hết hạn sau 60 giây. Tab mở NGAY khi bấm (trình
 * duyệt không chặn popup) rồi mới trỏ tới URL.
 */
export function useOpenPrivateFile(
  bucket: typeof SELLER_DOCUMENTS_BUCKET | typeof EVIDENCE_BUCKET,
) {
  const mutation = useMutation({
    mutationFn: (path: string) => createSignedFileUrl(bucket, path),
    onError: (error) => notifyError('Không mở được file', error),
  })
  const open = (path: string) => {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    mutation.mutate(path, {
      onSuccess: (url) => {
        if (tab) tab.location.href = url
        else window.location.assign(url)
      },
      onError: () => tab?.close(),
    })
  }
  return { open, pendingPath: mutation.isPending ? mutation.variables : undefined }
}
