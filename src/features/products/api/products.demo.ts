import {
  DemoDbError,
  SALE_STATUSES,
  matchesTerm,
  newId,
  normalizeName,
  nowIso,
  paginate,
  readDemoDb,
  requireApprovedSeller,
  sortRows,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import { toSearchTerm } from '@/shared/lib/search'
import type { Json, Tables } from '@/shared/types/database.types'
import { toSkuNamePart } from '../lib/sku'
import { mediaPaths, type ProductMedia } from '../lib/productImages'
import type { ProductFormValues } from '../schemas/product.schema'
import type { ProductFilters } from '../schemas/productFilters.schema'
import type {
  ImportedProductRow,
  Product,
  ProductImportPage,
  ProductInsight,
  ProductPage,
  TrashedProductPage,
} from '../types'
import type { ImportFromFileInput, ImportFromFileResult } from './productImports.api'
import { removeProductImages, uploadProductMedia } from './productImages.api'
import type { RestoreResult, TrashResult } from './productTrash.api'

/*
 * Backend giả lập (chế độ demo — ADR 011) cho các hàm trong products.api / productTrash.api /
 * productImports.api. Quy tắc giống trigger + RPC Postgres tương ứng.
 */

type ProductRow = Tables<'products'>

const categoryName = (db: DemoDb, id: string | null) =>
  db.categories.find((c) => c.id === id)?.name ?? null

const toProduct = (db: DemoDb, row: ProductRow): Product => ({
  ...row,
  category: categoryName(db, row.category_id),
})

function ownProduct(db: DemoDb, id: string): ProductRow {
  const sellerId = requireApprovedSeller(db)
  const product = db.products.find((p) => p.id === id && p.seller_id === sellerId)
  if (!product) throw new DemoDbError('PRODUCT_NOT_FOUND')
  return product
}

function assertUniqueName(db: DemoDb, sellerId: string, name: string, exceptId?: string) {
  const key = normalizeName(name)
  const clash = db.products.some(
    (p) => p.seller_id === sellerId && p.id !== exceptId && normalizeName(p.name) === key,
  )
  if (clash) {
    throw new DemoDbError(
      'duplicate key value violates unique constraint "products_seller_name_key"',
      null,
      '23505',
    )
  }
}

function assertOwnCategory(db: DemoDb, sellerId: string, categoryId: string | null) {
  if (categoryId && !db.categories.some((c) => c.id === categoryId && c.seller_id === sellerId)) {
    throw new DemoDbError('CATEGORY_NOT_FOUND')
  }
}

/** SKU "DN-TENSANPHAM-001" — như trigger `set_product_sku`. */
function nextSku(db: DemoDb, sellerId: string, name: string): string {
  const seq = (db.counters.sku[sellerId] ?? 0) + 1
  db.counters.sku[sellerId] = seq
  return `DN-${toSkuNamePart(name)}-${String(seq).padStart(3, '0')}`
}

interface NewProduct {
  name: string
  category_id: string | null
  unit: string
  price: number
  cost_price: number
  stock: number
  low_stock_threshold: number
  is_active: boolean
  description: string | null
  hero_image_path?: string | null
  image_paths?: string[]
  import_id?: string | null
}

/** Insert sản phẩm + ghi biến động "tồn đầu kỳ" nếu có tồn (như trigger DB). */
function insertProduct(db: DemoDb, sellerId: string, input: NewProduct): ProductRow {
  assertUniqueName(db, sellerId, input.name)
  assertOwnCategory(db, sellerId, input.category_id)
  const createdAt = nowIso()
  const product: ProductRow = {
    id: newId(),
    seller_id: sellerId,
    sku: nextSku(db, sellerId, input.name),
    name: input.name,
    category_id: input.category_id,
    unit: input.unit,
    price: input.price,
    cost_price: input.cost_price,
    stock: input.stock,
    low_stock_threshold: input.low_stock_threshold,
    is_low_stock: input.stock <= input.low_stock_threshold,
    is_active: input.is_active,
    description: input.description,
    hero_image_path: input.hero_image_path ?? null,
    image_paths: input.image_paths ?? [],
    import_id: input.import_id ?? null,
    created_at: createdAt,
  }
  db.products.push(product)
  if (product.stock > 0) {
    db.inventory_movements.push({
      id: newId(),
      seller_id: sellerId,
      product_id: product.id,
      delta: product.stock,
      reason: 'initial_stock',
      note: null,
      order_id: null,
      receipt_id: null,
      unit_cost: product.cost_price,
      created_at: createdAt,
    })
  }
  return product
}

// -----------------------------------------------------------------------------
// products.api
// -----------------------------------------------------------------------------

export async function fetchProducts(
  sellerId: string,
  filters: ProductFilters,
): Promise<ProductPage> {
  const db = await readDemoDb()
  const term = toSearchTerm(filters.q)
  const rows = db.products.filter(
    (p) =>
      p.seller_id === sellerId &&
      matchesTerm(term, p.name, p.sku) &&
      (!filters.category || p.category_id === filters.category) &&
      (filters.status === 'all' ||
        filters.status === 'needs_category' ||
        p.is_active === (filters.status === 'active')) &&
      (filters.status !== 'needs_category' || p.category_id === null),
  )
  const sorted = sortRows(rows, (p) => p[filters.sort], filters.order === 'asc')
  const { items, total } = paginate(sorted, filters.page, filters.pageSize)
  return { items: items.map((p) => toProduct(db, p)), total }
}

export async function createProduct(
  sellerId: string,
  values: ProductFormValues,
  media: ProductMedia,
): Promise<Product> {
  const { uploaded, ...paths } = await uploadProductMedia(sellerId, media)
  try {
    return await writeDemoDb((db) => {
      if (requireApprovedSeller(db) !== sellerId) throw new DemoDbError('FORBIDDEN')
      const product = insertProduct(db, sellerId, {
        ...values,
        description: values.description || null,
        ...paths,
      })
      return toProduct(db, product)
    })
  } catch (error) {
    await removeProductImages(uploaded)
    throw error
  }
}

export async function updateProduct(
  sellerId: string,
  product: Product,
  values: ProductFormValues,
  media: ProductMedia,
): Promise<Product> {
  const { uploaded, ...paths } = await uploadProductMedia(sellerId, media)
  let saved: Product
  try {
    saved = await writeDemoDb((db) => {
      const row = ownProduct(db, product.id)
      if (values.name !== row.name) assertUniqueName(db, row.seller_id, values.name, row.id)
      assertOwnCategory(db, row.seller_id, values.category_id)
      Object.assign(row, {
        name: values.name,
        category_id: values.category_id,
        unit: values.unit,
        price: values.price,
        cost_price: values.cost_price,
        low_stock_threshold: values.low_stock_threshold,
        is_active: values.is_active,
        description: values.description || null,
        ...paths,
      })
      return toProduct(db, row)
    })
  } catch (error) {
    await removeProductImages(uploaded)
    throw error
  }
  // Ảnh bị gỡ khỏi sản phẩm được dọn SAU khi lưu thành công (như bản thật).
  const kept = new Set(mediaPaths(media))
  await removeProductImages(
    [product.hero_image_path, ...product.image_paths].filter(
      (path): path is string => path !== null && !kept.has(path),
    ),
  )
  return saved
}

const patchProduct = (id: string, patch: Partial<ProductRow>) =>
  writeDemoDb((db) => {
    Object.assign(ownProduct(db, id), patch)
  })

export const updateProductPrice = (id: string, price: number) => patchProduct(id, { price })
export const updateProductCost = (id: string, costPrice: number) =>
  patchProduct(id, { cost_price: costPrice })
export const setProductActive = (id: string, isActive: boolean) =>
  patchProduct(id, { is_active: isActive })

export async function fetchProductInsight(id: string): Promise<ProductInsight> {
  const db = await readDemoDb()
  const saleOrders = new Set(db.orders.filter((o) => SALE_STATUSES.has(o.status)).map((o) => o.id))
  const sold = db.order_items.filter((i) => i.product_id === id && saleOrders.has(i.order_id))
  const revenue = sold.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const cogs = Math.round(sold.reduce((sum, i) => sum + i.quantity * (i.unit_cost ?? 0), 0))

  const posted = new Map(
    db.purchase_receipts.filter((r) => r.status === 'posted').map((r) => [r.id, r]),
  )
  const received = db.purchase_receipt_items
    .filter((i) => i.product_id === id && posted.has(i.receipt_id))
    .map((item) => ({ item, receipt: posted.get(item.receipt_id) }))
    .sort((a, b) => (b.receipt?.posted_at ?? '').localeCompare(a.receipt?.posted_at ?? ''))
  const last = received[0]

  return {
    qty_sold: sold.reduce((sum, i) => sum + i.quantity, 0),
    revenue,
    cogs,
    gross_profit: revenue - cogs,
    qty_received: received.reduce((sum, r) => sum + r.item.received_qty, 0),
    qty_defective: received.reduce((sum, r) => sum + r.item.defective_qty, 0),
    receipt_count: new Set(received.map((r) => r.item.receipt_id)).size,
    last_receipt_cost: last?.item.unit_cost ?? (null as unknown as number),
    last_receipt_date: last?.receipt?.received_date ?? (null as unknown as string),
  }
}

// -----------------------------------------------------------------------------
// productTrash.api
// -----------------------------------------------------------------------------

const TRASH_DAYS = 30

export async function trashProducts(ids: readonly string[]): Promise<TrashResult> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    let trashed = 0
    let deactivated = 0
    for (const id of ids) {
      const product = db.products.find((p) => p.id === id && p.seller_id === sellerId)
      if (!product) continue
      const inUse =
        db.order_items.some((i) => i.product_id === id) ||
        db.purchase_receipt_items.some((i) => i.product_id === id)
      if (inUse) {
        // Đã có trong đơn / phiếu nhập: giữ lịch sử, chỉ ngừng bán.
        product.is_active = false
        deactivated += 1
        continue
      }
      const deletedAt = new Date()
      db.product_trash.push({
        id: product.id,
        seller_id: sellerId,
        sku: product.sku,
        name: product.name,
        category: categoryName(db, product.category_id),
        unit: product.unit,
        price: product.price,
        cost_price: product.cost_price,
        stock: product.stock,
        hero_image_path: product.hero_image_path,
        image_paths: product.image_paths,
        deleted_at: deletedAt.toISOString(),
        purge_at: new Date(deletedAt.getTime() + TRASH_DAYS * 86_400_000).toISOString(),
        product: product as unknown as Json,
        movements: db.inventory_movements.filter((m) => m.product_id === id) as unknown as Json,
      })
      db.products = db.products.filter((p) => p.id !== id)
      db.inventory_movements = db.inventory_movements.filter((m) => m.product_id !== id)
      trashed += 1
    }
    return { trashed, deactivated }
  })
}

export async function restoreProducts(ids: readonly string[]): Promise<RestoreResult> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    let restored = 0
    const skipped: string[] = []
    for (const id of ids) {
      const item = db.product_trash.find((t) => t.id === id && t.seller_id === sellerId)
      if (!item) continue
      const key = normalizeName(item.name)
      if (db.products.some((p) => p.seller_id === sellerId && normalizeName(p.name) === key)) {
        skipped.push(item.name)
        continue
      }
      const product = item.product as unknown as ProductRow
      // Danh mục cũ có thể đã bị xóa → sản phẩm về "chưa phân loại".
      if (product.category_id && !db.categories.some((c) => c.id === product.category_id)) {
        product.category_id = null
      }
      db.products.push(product)
      db.inventory_movements.push(
        ...((item.movements as unknown as Tables<'inventory_movements'>[]) ?? []),
      )
      db.product_trash = db.product_trash.filter((t) => t.id !== id)
      restored += 1
    }
    return { restored, skipped }
  })
}

const imagePathsOf = (item: Pick<Tables<'product_trash'>, 'hero_image_path' | 'image_paths'>) =>
  [item.hero_image_path, ...item.image_paths].filter((p): p is string => p !== null)

export async function purgeTrash(ids: readonly string[]): Promise<number> {
  const paths = await writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    const removed = db.product_trash.filter((t) => t.seller_id === sellerId && ids.includes(t.id))
    db.product_trash = db.product_trash.filter((t) => !removed.includes(t))
    return removed.flatMap(imagePathsOf)
  })
  await removeProductImages(paths)
  return ids.length
}

async function purgeExpired(sellerId: string): Promise<void> {
  const now = nowIso()
  const db = await readDemoDb()
  if (!db.product_trash.some((t) => t.seller_id === sellerId && t.purge_at <= now)) return
  const paths = await writeDemoDb((draft) => {
    const expired = draft.product_trash.filter((t) => t.seller_id === sellerId && t.purge_at <= now)
    draft.product_trash = draft.product_trash.filter((t) => !expired.includes(t))
    return expired.flatMap(imagePathsOf)
  })
  await removeProductImages(paths)
}

export async function fetchProductTrash(
  sellerId: string,
  page: number,
  pageSize: number,
): Promise<TrashedProductPage> {
  await purgeExpired(sellerId)
  const db = await readDemoDb()
  const rows = sortRows(
    db.product_trash.filter((t) => t.seller_id === sellerId),
    (t) => t.deleted_at,
    false,
  )
  return paginate(rows, page, pageSize)
}

export async function countProductTrash(sellerId: string): Promise<number> {
  const db = await readDemoDb()
  return db.product_trash.filter((t) => t.seller_id === sellerId).length
}

export async function findExistingProductNames(names: readonly string[]): Promise<Set<string>> {
  const db = await readDemoDb()
  const sellerId = requireApprovedSeller(db)
  const existing = new Set(
    db.products.filter((p) => p.seller_id === sellerId).map((p) => normalizeName(p.name)),
  )
  return new Set(names.filter((name) => existing.has(normalizeName(name))))
}

// -----------------------------------------------------------------------------
// productImports.api
// -----------------------------------------------------------------------------

/** File Excel gốc chỉ giữ trong bộ nhớ của tab (tải lại trang thì không tải lại được nữa). */
const importFiles = new Map<string, File>()

export async function importProductsFromFile(
  sellerId: string,
  { file, sheetName, rowCount, products }: ImportFromFileInput,
): Promise<ImportFromFileResult> {
  const path = `${sellerId}/${newId()}.${file.name.split('.').pop() ?? 'xlsx'}`
  const result = await writeDemoDb((db) => {
    if (requireApprovedSeller(db) !== sellerId) throw new DemoDbError('FORBIDDEN')
    if (products.length === 0) throw new DemoDbError('IMPORT_EMPTY')
    if (products.length > 1000) throw new DemoDbError('TOO_MANY_ROWS')

    const importId = newId()
    const publishedCount = products.filter((p) => p.publish).length
    db.product_imports.push({
      id: importId,
      seller_id: sellerId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      sheet_name: sheetName,
      row_count: rowCount,
      imported_count: products.length,
      published: publishedCount > 0,
      published_count: publishedCount,
      created_at: nowIso(),
    })

    for (const row of products) {
      const key = row.category ? normalizeName(row.category) : null
      const category = key
        ? db.categories.find((c) => c.seller_id === sellerId && normalizeName(c.name) === key)
        : undefined
      if (key && !category) throw new DemoDbError('CATEGORY_NOT_FOUND')
      try {
        insertProduct(db, sellerId, {
          name: row.name,
          category_id: category?.id ?? null,
          unit: row.unit,
          price: row.price,
          cost_price: row.cost_price,
          stock: row.stock,
          low_stock_threshold: row.low_stock_threshold,
          is_active: row.publish,
          description: row.description,
          import_id: importId,
        })
      } catch (error) {
        if (error instanceof DemoDbError && error.code === '23505') {
          throw new DemoDbError('DUPLICATE_PRODUCT_NAME', row.name)
        }
        throw error
      }
    }
    return { importId, count: products.length, publishedCount }
  })
  importFiles.set(path, file)
  return result
}

export async function fetchProductImports(
  sellerId: string,
  page: number,
  pageSize: number,
): Promise<ProductImportPage> {
  const db = await readDemoDb()
  const rows = sortRows(
    db.product_imports.filter((i) => i.seller_id === sellerId),
    (i) => i.created_at,
    false,
  )
  return paginate(rows, page, pageSize)
}

export async function fetchImportedProducts(
  sellerId: string,
  importId: string,
): Promise<ImportedProductRow[]> {
  const db = await readDemoDb()
  return sortRows(
    db.products.filter((p) => p.seller_id === sellerId && p.import_id === importId),
    (p) => p.created_at,
    true,
  ).map((p) => ({ ...p, category: categoryName(db, p.category_id) }))
}

export async function getImportFileUrl(item: { file_path: string; file_name: string }) {
  const file = importFiles.get(item.file_path)
  if (!file) throw new DemoDbError('FILE_NOT_AVAILABLE_IN_DEMO')
  return URL.createObjectURL(file)
}
