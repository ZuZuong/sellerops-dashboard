import {
  DemoDbError,
  currentProfile,
  newId,
  normalizeName,
  nowIso,
  ownSeller,
  readDemoDb,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import type { CategoryOverview } from '../types'
import type { DeleteCategoryResult } from './categories.api'

/* Backend giả lập (chế độ demo — ADR 011) cho categories.api; quy tắc như RPC danh mục. */

const EDITABLE_STATUSES = new Set(['draft', 'rejected', 'approved'])

/** Như `require_category_editor`: chủ shop, shop ở trạng thái còn sửa được danh mục. */
function requireEditor(db: DemoDb): string {
  currentProfile(db)
  const seller = ownSeller(db)
  if (!seller) throw new DemoDbError('SELLER_NOT_FOUND')
  if (!EDITABLE_STATUSES.has(seller.status)) throw new DemoDbError('CATEGORY_EDIT_NOT_ALLOWED')
  return seller.id
}

function cleanName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (clean.length < 1 || clean.length > 50) throw new DemoDbError('INVALID_CATEGORY_NAME')
  return clean
}

function assertUnique(db: DemoDb, sellerId: string, name: string, exceptId?: string) {
  const key = normalizeName(name)
  if (
    db.categories.some(
      (c) => c.seller_id === sellerId && c.id !== exceptId && normalizeName(c.name) === key,
    )
  ) {
    throw new DemoDbError('CATEGORY_NAME_EXISTS')
  }
}

const slugify = (name: string) =>
  normalizeName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function ownCategory(db: DemoDb, sellerId: string, id: string) {
  const category = db.categories.find((c) => c.id === id && c.seller_id === sellerId)
  if (!category) throw new DemoDbError('CATEGORY_NOT_FOUND')
  return category
}

export async function fetchCategories(sellerId: string): Promise<CategoryOverview[]> {
  const db = await readDemoDb()
  const profile = currentProfile(db)
  if (profile.role !== 'admin' && ownSeller(db)?.id !== sellerId) {
    throw new DemoDbError('FORBIDDEN')
  }
  return db.categories
    .filter((c) => c.seller_id === sellerId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'))
    .map((c) => {
      const products = db.products.filter((p) => p.category_id === c.id)
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        sort_order: c.sort_order,
        is_active: c.is_active,
        created_at: c.created_at,
        product_count: products.length,
        active_count: products.filter((p) => p.is_active).length,
      }
    })
}

export async function createCategory(name: string): Promise<string> {
  return writeDemoDb((db) => {
    const sellerId = requireEditor(db)
    const clean = cleanName(name)
    assertUnique(db, sellerId, clean)
    const id = newId()
    const maxOrder = Math.max(
      0,
      ...db.categories.filter((c) => c.seller_id === sellerId).map((c) => c.sort_order),
    )
    db.categories.push({
      id,
      seller_id: sellerId,
      name: clean,
      slug: slugify(clean),
      sort_order: maxOrder + 1,
      is_active: true,
      created_at: nowIso(),
    })
    return id
  })
}

export async function updateCategory(id: string, name: string, isActive: boolean): Promise<void> {
  return writeDemoDb((db) => {
    const sellerId = requireEditor(db)
    const category = ownCategory(db, sellerId, id)
    const clean = cleanName(name)
    assertUnique(db, sellerId, clean, id)
    Object.assign(category, { name: clean, slug: slugify(clean), is_active: isActive })
  })
}

export async function reorderCategories(ids: readonly string[]): Promise<void> {
  return writeDemoDb((db) => {
    const sellerId = requireEditor(db)
    ids.forEach((id, index) => {
      ownCategory(db, sellerId, id).sort_order = index + 1
    })
  })
}

export async function deleteCategory(
  id: string,
  moveToId: string | null,
): Promise<DeleteCategoryResult> {
  return writeDemoDb((db) => {
    const sellerId = requireEditor(db)
    ownCategory(db, sellerId, id)
    const products = db.products.filter((p) => p.category_id === id)
    if (products.length > 0) {
      if (!moveToId || moveToId === id) throw new DemoDbError('CATEGORY_IN_USE')
      ownCategory(db, sellerId, moveToId)
      products.forEach((p) => {
        p.category_id = moveToId
      })
    }
    db.categories = db.categories.filter((c) => c.id !== id)
    return { moved: products.length }
  })
}
