import { env } from '@/shared/lib/env'
import { supabase } from '@/shared/lib/supabase'
import type { Tables } from '@/shared/types/database.types'
import {
  buildDocumentPath,
  documentMimeType,
  validateDocumentFile,
  type DocumentKind,
} from '../lib/documentFile'
import type { BusinessInfoValues } from '../schemas/application.schema'
import { TERMS_VERSION } from '../terms'

export const SELLER_DOCUMENTS_BUCKET = 'seller-documents'

/** Lỗi phía client khi tải giấy tờ (map sang tiếng Việt trong `onboardingErrors`). */
export const DOCUMENT_UPLOAD_FAILED = 'DOCUMENT_UPLOAD_FAILED'
export const DOCUMENT_INVALID = 'DOCUMENT_INVALID'

export type SellerDocument = Pick<
  Tables<'seller_documents'>,
  'id' | 'kind' | 'storage_path' | 'file_name' | 'mime_type' | 'file_size' | 'created_at'
>

/** Bước stepper 1–4 lưu trong `sellers.current_step` để tải lại trang quay về đúng bước. */
export type ApplicationStep = 1 | 2 | 3 | 4

/**
 * Lưu nháp hồ sơ: chỉ các trường có trong `data` được cập nhật. Chỉ chủ shop, chỉ khi `draft` /
 * `rejected` (RPC kiểm tra lại).
 */
export async function saveApplication(
  data: Partial<BusinessInfoValues>,
  step: ApplicationStep,
): Promise<void> {
  const { error } = await supabase.rpc('save_seller_application', { p_data: data, p_step: step })
  if (error) throw error
}

/**
 * Gửi hồ sơ (→ `pending`). DB kiểm tra đủ thông tin, có giấy phép, ≥ 1 danh mục và ghi lại phiên
 * bản cam kết seller đã chấp nhận.
 */
export async function submitApplication(): Promise<void> {
  const { error } = await supabase.rpc('submit_seller_application', {
    p_terms_version: TERMS_VERSION,
  })
  if (error) throw error
}

export async function fetchDocuments(sellerId: string): Promise<SellerDocument[]> {
  const { data, error } = await supabase
    .from('seller_documents')
    .select('id, kind, storage_path, file_name, mime_type, file_size, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Tải file lên Storage bằng XMLHttpRequest để có tiến trình (supabase-js không báo tiến trình).
 * Dùng đúng endpoint + JWT của phiên hiện tại → RLS Storage và giới hạn của bucket vẫn áp dụng.
 */
async function uploadWithProgress(
  path: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('NOT_AUTHENTICATED')

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const url = `${env.VITE_SUPABASE_URL}/storage/v1/object/${SELLER_DOCUMENTS_BUCKET}/${encodedPath}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', env.VITE_SUPABASE_PUBLISHABLE_KEY)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(DOCUMENT_UPLOAD_FAILED, { cause: xhr.status }))
    xhr.onerror = () => reject(new Error(DOCUMENT_UPLOAD_FAILED))
    xhr.send(file)
  })
}

async function removeFile(path: string): Promise<void> {
  await supabase.storage.from(SELLER_DOCUMENTS_BUCKET).remove([path])
}

export interface UploadDocumentInput {
  ownerId: string
  sellerId: string
  kind: DocumentKind
  file: File
  /** Giấy tờ cũ cùng loại bị thay thế (xóa SAU khi file mới đã lưu thành công). */
  replace?: SellerDocument
  onProgress: (percent: number) => void
}

/** Tải file → ghi `seller_documents`. Ghi lỗi thì xóa file vừa tải để không để lại file mồ côi. */
export async function uploadDocument({
  ownerId,
  sellerId,
  kind,
  file,
  replace,
  onProgress,
}: UploadDocumentInput): Promise<void> {
  const contentType = documentMimeType(file)
  if (!contentType || validateDocumentFile(file)) throw new Error(DOCUMENT_INVALID)

  const path = buildDocumentPath(ownerId, kind, file.name)
  await uploadWithProgress(path, file, contentType, onProgress)

  const { error } = await supabase.from('seller_documents').insert({
    seller_id: sellerId,
    kind,
    storage_path: path,
    file_name: file.name.slice(0, 255),
    mime_type: contentType,
    file_size: file.size,
  })
  if (error) {
    await removeFile(path)
    throw error
  }

  if (replace) await deleteDocument(replace)
}

/** Xóa giấy tờ (chỉ khi hồ sơ còn sửa được — RLS bảng và Storage cùng chặn). */
export async function deleteDocument(document: SellerDocument): Promise<void> {
  const { error } = await supabase.from('seller_documents').delete().eq('id', document.id)
  if (error) throw error
  await removeFile(document.storage_path)
}

/** Link xem giấy tờ (bucket riêng tư → signed URL hết hạn sau 60 giây). */
export async function getDocumentUrl(document: SellerDocument): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SELLER_DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, 60)
  if (error) throw error
  return data.signedUrl
}
