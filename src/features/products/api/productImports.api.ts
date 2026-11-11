import { supabase } from '@/shared/lib/supabase'
import type { ImportedRow } from '../lib/importProducts'
import type { ImportedProductRow, ProductImport, ProductImportPage } from '../types'
import { NOT_AUTHENTICATED } from './productImages.api'

/** Bucket riêng tư lưu file Excel gốc của mỗi lần import: `<user_id>/<uuid>.<ext>`. */
export const PRODUCT_IMPORTS_BUCKET = 'product-imports'
export const FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED'

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
}

/** Đuôi + MIME theo tên file (trình duyệt đôi khi báo MIME rỗng cho .csv / .xls). */
export function spreadsheetFileType(fileName: string): { extension: string; contentType: string } {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  const contentType = CONTENT_TYPES[extension]
  return contentType
    ? { extension, contentType }
    : { extension: 'xlsx', contentType: CONTENT_TYPES.xlsx ?? '' }
}

export interface ImportFromFileInput {
  file: File
  sheetName: string | null
  /** Số dòng dữ liệu trong file. */
  rowCount: number
  products: readonly ImportedRow[]
  publish: boolean
}

export interface ImportFromFileResult {
  importId: string
  count: number
}

/**
 * Nhập sản phẩm từ file Excel:
 *  1. Lưu file gốc vào Storage (thư mục của user) để tra cứu / tải lại sau.
 *  2. RPC `import_products`: ghi lịch sử + tạo toàn bộ sản phẩm trong MỘT transaction.
 * RPC lỗi → xóa file vừa tải để không để lại file mồ côi.
 */
export async function importProductsFromFile({
  file,
  sheetName,
  rowCount,
  products,
  publish,
}: ImportFromFileInput): Promise<ImportFromFileResult> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user.id
  if (!userId) throw new Error(NOT_AUTHENTICATED)

  const { extension, contentType } = spreadsheetFileType(file.name)
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage
    .from(PRODUCT_IMPORTS_BUCKET)
    .upload(path, file, { contentType, upsert: false })
  if (upload.error) throw new Error(FILE_UPLOAD_FAILED, { cause: upload.error })

  // Chỉ gửi các cột được phép ghi (dòng nhập kèm field phụ như rowNumber).
  const rows = products.map(
    ({ name, category, unit, cost_price, price, stock, low_stock_threshold, description }) => ({
      name,
      category,
      unit,
      cost_price,
      price,
      stock,
      low_stock_threshold,
      description,
    }),
  )

  const { data, error } = await supabase.rpc('import_products', {
    p_file: {
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      sheet_name: sheetName,
      row_count: rowCount,
    },
    p_products: rows,
    p_publish: publish,
  })
  if (error) {
    await supabase.storage.from(PRODUCT_IMPORTS_BUCKET).remove([path])
    throw error
  }
  return { importId: data, count: rows.length }
}

const IMPORT_COLUMNS =
  'id, file_name, file_path, file_size, sheet_name, row_count, imported_count, published, created_at'

/** Lịch sử import, mới nhất trước, phân trang phía server. */
export async function fetchProductImports(
  page: number,
  pageSize: number,
): Promise<ProductImportPage> {
  const from = (page - 1) * pageSize
  const { data, error, count } = await supabase
    .from('product_imports')
    .select(IMPORT_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  if (error) throw error
  return { items: data satisfies ProductImport[], total: count ?? data.length }
}

/** Sản phẩm được tạo từ một lần import (kèm trạng thái hiện tại). */
export async function fetchImportedProducts(importId: string): Promise<ImportedProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, category, unit, cost_price, price, stock, is_active')
    .eq('import_id', importId)
    .order('created_at', { ascending: true })
    .order('sku', { ascending: true })
  if (error) throw error
  return data
}

/** Link tải file gốc (signed URL hết hạn sau 60 giây; bucket riêng tư). */
export async function getImportFileUrl(item: Pick<ProductImport, 'file_path' | 'file_name'>) {
  const { data, error } = await supabase.storage
    .from(PRODUCT_IMPORTS_BUCKET)
    .createSignedUrl(item.file_path, 60, { download: item.file_name })
  if (error) throw error
  return data.signedUrl
}
