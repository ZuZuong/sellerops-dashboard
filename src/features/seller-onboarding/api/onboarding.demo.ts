import { getDemoFileUrl, putDemoFile, removeDemoFiles } from '@/shared/lib/demo/demoFiles'
import {
  DemoDbError,
  currentProfile,
  logAudit,
  newId,
  nowIso,
  ownSeller,
  readDemoDb,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import { buildDocumentPath, documentMimeType, validateDocumentFile } from '../lib/documentFile'
import type { BusinessInfoValues } from '../schemas/application.schema'
import { TERMS_VERSION } from '../terms'
import {
  DOCUMENT_INVALID,
  type ApplicationStep,
  type SellerDocument,
  type UploadDocumentInput,
} from './onboarding.api'

/* Backend giả lập (chế độ demo — ADR 011) cho onboarding.api; như save / submit_seller_application. */

/** Như `lock_editable_application`: hồ sơ của chính mình, chỉ khi draft / rejected. */
function editableSeller(db: DemoDb) {
  currentProfile(db)
  const seller = ownSeller(db)
  if (!seller) throw new DemoDbError('SELLER_NOT_FOUND')
  if (seller.status !== 'draft' && seller.status !== 'rejected') {
    throw new DemoDbError('APPLICATION_LOCKED')
  }
  return seller
}

const TEXT_FIELDS = [
  'shop_name',
  'business_name',
  'tax_code',
  'license_number',
  'address',
  'representative_name',
  'representative_phone',
  'contact_email',
  'main_category',
] as const

export async function saveApplication(
  data: Partial<BusinessInfoValues>,
  step: ApplicationStep,
): Promise<void> {
  return writeDemoDb((db) => {
    const seller = editableSeller(db)
    for (const field of TEXT_FIELDS) {
      if (field in data) {
        const value = data[field]?.trim() || null
        seller[field] = field === 'contact_email' ? (value?.toLowerCase() ?? null) : value
      }
    }
    if (data.business_type) seller.business_type = data.business_type
    seller.current_step = Math.min(Math.max(step, 1), 4)
    seller.slug =
      seller.shop_name
        ?.normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ?? null
    seller.updated_at = nowIso()
  })
}

export async function submitApplication(): Promise<void> {
  return writeDemoDb((db) => {
    const seller = editableSeller(db)
    const missing = [...TEXT_FIELDS, 'business_type' as const].filter((f) => !seller[f])
    if (missing.length > 0) throw new DemoDbError('APPLICATION_INCOMPLETE', missing.join(','))
    if (
      !db.seller_documents.some((d) => d.seller_id === seller.id && d.kind === 'business_license')
    ) {
      throw new DemoDbError('BUSINESS_LICENSE_REQUIRED')
    }
    if (!db.categories.some((c) => c.seller_id === seller.id)) {
      throw new DemoDbError('CATEGORY_REQUIRED')
    }
    const now = nowIso()
    const resubmitted = seller.status === 'rejected'
    Object.assign(seller, {
      status: 'pending',
      submitted_at: now,
      terms_version: TERMS_VERSION,
      terms_accepted_at: now,
      current_step: 4,
      updated_at: now,
    })
    logAudit(db, 'seller.submitted', 'seller', seller.id, {
      terms_version: TERMS_VERSION,
      resubmitted,
    })
  })
}

export async function fetchDocuments(sellerId: string): Promise<SellerDocument[]> {
  const db = await readDemoDb()
  return db.seller_documents
    .filter((d) => d.seller_id === sellerId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

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
  onProgress(30)
  await putDemoFile(path, file)
  onProgress(100)
  await writeDemoDb((db) => {
    if (editableSeller(db).id !== sellerId) throw new DemoDbError('FORBIDDEN')
    db.seller_documents.push({
      id: newId(),
      seller_id: sellerId,
      kind,
      storage_path: path,
      file_name: file.name.slice(0, 255),
      mime_type: contentType,
      file_size: file.size,
      created_at: nowIso(),
    })
  }).catch((error: unknown) => {
    removeDemoFiles([path])
    throw error
  })
  if (replace) await deleteDocument(replace)
}

export async function deleteDocument(document: SellerDocument): Promise<void> {
  await writeDemoDb((db) => {
    const seller = editableSeller(db)
    db.seller_documents = db.seller_documents.filter(
      (d) => !(d.id === document.id && d.seller_id === seller.id),
    )
  })
  removeDemoFiles([document.storage_path])
}

export async function getDocumentUrl(document: SellerDocument): Promise<string> {
  return getDemoFileUrl(document.storage_path, document.file_name)
}
