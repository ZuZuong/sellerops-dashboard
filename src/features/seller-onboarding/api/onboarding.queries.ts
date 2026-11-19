import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerKeys } from '@/features/sellers'
import { getOnboardingErrorMessage } from '../lib/onboardingErrors'
import { DOCUMENT_KIND_META } from '../lib/documentFile'
import type { BusinessInfoValues } from '../schemas/application.schema'
import {
  deleteDocument,
  fetchDocuments,
  getDocumentUrl,
  saveApplication,
  submitApplication,
  uploadDocument,
  type ApplicationStep,
  type SellerDocument,
  type UploadDocumentInput,
} from './onboarding.api'

export const onboardingKeys = {
  all: ['seller-onboarding'] as const,
  documents: (sellerId: string) => [...onboardingKeys.all, 'documents', sellerId] as const,
}

function notifyError(title: string, error: unknown) {
  notifications.show({ color: 'red', title, message: getOnboardingErrorMessage(error) })
}

export interface SaveStepVariables {
  /** Dữ liệu bước 1 (bỏ trống ở các bước khác — chỉ lưu bước đang làm). */
  data?: Partial<BusinessInfoValues>
  step: ApplicationStep
  /** Có hiện thông báo "đã lưu nháp" không (quay lại bước trước thì lưu im lặng). */
  silent?: boolean
}

/** Lưu nháp + ghi nhớ bước đang làm. Thành công → đọc lại shop (current_step, dữ liệu). */
export function useSaveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data = {}, step }: SaveStepVariables) => saveApplication(data, step),
    onSuccess: (_data, { silent }) => {
      if (!silent) {
        notifications.show({ color: 'green', title: 'Đã lưu nháp hồ sơ', message: '' })
      }
      return queryClient.invalidateQueries({ queryKey: sellerKeys.all })
    },
    onError: (error) => notifyError('Không lưu được hồ sơ', error),
  })
}

export function useSubmitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitApplication,
    onSuccess: () => {
      notifications.show({
        color: 'green',
        title: 'Đã gửi hồ sơ',
        message: 'Hồ sơ đang chờ quản trị viên xét duyệt.',
      })
      return queryClient.invalidateQueries({ queryKey: sellerKeys.all })
    },
    onError: (error) => notifyError('Không gửi được hồ sơ', error),
  })
}

export function useSellerDocuments(sellerId: string) {
  return useQuery({
    queryKey: onboardingKeys.documents(sellerId),
    queryFn: () => fetchDocuments(sellerId),
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(input),
    onSuccess: (_data, { kind, file, sellerId }) => {
      notifications.show({
        color: 'green',
        title: `Đã tải lên ${DOCUMENT_KIND_META[kind].label.toLowerCase()}`,
        message: file.name,
      })
      return queryClient.invalidateQueries({ queryKey: onboardingKeys.documents(sellerId) })
    },
    onError: (error) => notifyError('Không tải được giấy tờ', error),
  })
}

export function useDeleteDocument(sellerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (document: SellerDocument) => deleteDocument(document),
    onSuccess: (_data, document) => {
      notifications.show({ color: 'green', title: 'Đã xóa giấy tờ', message: document.file_name })
      return queryClient.invalidateQueries({ queryKey: onboardingKeys.documents(sellerId) })
    },
    onError: (error) => notifyError('Không xóa được giấy tờ', error),
  })
}

/**
 * Mở giấy tờ ở tab mới bằng signed URL ngắn hạn. Tab được mở NGAY trong lúc bấm (trước khi gọi
 * mạng) để trình duyệt không chặn popup, rồi mới trỏ tới URL khi có.
 */
export function useOpenDocument() {
  const mutation = useMutation({
    mutationFn: getDocumentUrl,
    onError: (error) => notifyError('Không mở được giấy tờ', error),
  })
  const open = (document: SellerDocument) => {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    mutation.mutate(document, {
      onSuccess: (url) => {
        if (tab) tab.location.href = url
        else window.location.assign(url)
      },
      onError: () => tab?.close(),
    })
  }
  return { open, isPending: mutation.isPending }
}
