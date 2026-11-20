import {
  DemoDbError,
  dateKeyOf,
  matchesTerm,
  newId,
  nextCounter,
  nowIso,
  padCode,
  paginate,
  readDemoDb,
  requireApprovedSeller,
  round,
  sortRows,
  writeDemoDb,
  type DemoDb,
} from '@/shared/lib/demo/demoDb'
import { toSearchTerm } from '@/shared/lib/search'
import type { ReceiptPayload } from '../schemas/receipt.schema'
import type { ReceiptFilters } from '../schemas/receiptFilters.schema'
import type { PurchaseReceiptPage, ReceiptDetail, ReceiptProduct } from '../types'

/*
 * Backend giả lập (chế độ demo — ADR 011) cho purchases.api. Duyệt phiếu cộng tồn theo SL thực
 * nhận và cập nhật giá vốn bình quân gia quyền như RPC post_purchase_receipt.
 */

const toReceiptProduct = (db: DemoDb, productId: string): ReceiptProduct | null => {
  const p = db.products.find((product) => product.id === productId)
  return p
    ? { id: p.id, name: p.name, sku: p.sku, unit: p.unit, stock: p.stock, cost_price: p.cost_price }
    : null
}

export async function fetchReceipts(
  sellerId: string,
  filters: ReceiptFilters,
): Promise<PurchaseReceiptPage> {
  const db = await readDemoDb()
  const term = toSearchTerm(filters.q)
  const rows = sortRows(
    db.purchase_receipts.filter(
      (r) =>
        r.seller_id === sellerId &&
        matchesTerm(term, r.code, r.supplier_name, r.invoice_number) &&
        (filters.status === 'all' || r.status === filters.status),
    ),
    (r) => r.created_at,
    false,
  )
  const { items, total } = paginate(rows, filters.page, filters.pageSize)
  return {
    total,
    items: items.map((r) => {
      const lines = db.purchase_receipt_items.filter((i) => i.receipt_id === r.id)
      return {
        id: r.id,
        code: r.code,
        status: r.status,
        supplier_name: r.supplier_name,
        supplier_phone: r.supplier_phone,
        invoice_number: r.invoice_number,
        received_date: r.received_date,
        total_amount: r.total_amount,
        created_at: r.created_at,
        posted_at: r.posted_at,
        received_qty: lines.reduce((sum, i) => sum + i.received_qty, 0),
        defective_qty: lines.reduce((sum, i) => sum + i.defective_qty, 0),
      }
    }),
  }
}

export async function fetchReceipt(sellerId: string, id: string): Promise<ReceiptDetail | null> {
  const db = await readDemoDb()
  const r = db.purchase_receipts.find(
    (receipt) => receipt.id === id && receipt.seller_id === sellerId,
  )
  if (!r) return null
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    supplier_name: r.supplier_name,
    supplier_phone: r.supplier_phone,
    invoice_number: r.invoice_number,
    delivered_by: r.delivered_by,
    received_date: r.received_date,
    note: r.note,
    total_amount: r.total_amount,
    created_at: r.created_at,
    updated_at: r.updated_at,
    posted_at: r.posted_at,
    items: db.purchase_receipt_items
      .filter((i) => i.receipt_id === r.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        id: i.id,
        product_id: i.product_id,
        ordered_qty: i.ordered_qty,
        received_qty: i.received_qty,
        defective_qty: i.defective_qty,
        unit_cost: i.unit_cost,
        condition_note: i.condition_note,
        position: i.position,
        product: toReceiptProduct(db, i.product_id),
      })),
  }
}

export async function searchReceiptProducts(
  sellerId: string,
  q: string,
  limit = 20,
): Promise<ReceiptProduct[]> {
  const db = await readDemoDb()
  const term = toSearchTerm(q)
  return sortRows(
    db.products.filter((p) => p.seller_id === sellerId && matchesTerm(term, p.name, p.sku)),
    (p) => p.name,
    true,
  )
    .slice(0, limit)
    .flatMap((p) => toReceiptProduct(db, p.id) ?? [])
}

const clean = (value: string | null | undefined) => value?.trim() || null

function draftOf(db: DemoDb, sellerId: string, id: string) {
  const receipt = db.purchase_receipts.find((r) => r.id === id && r.seller_id === sellerId)
  if (!receipt) throw new DemoDbError('RECEIPT_NOT_FOUND')
  if (receipt.status !== 'draft') throw new DemoDbError('RECEIPT_NOT_DRAFT')
  return receipt
}

export async function saveReceipt(id: string | null, payload: ReceiptPayload): Promise<string> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    const supplier = clean(payload.header.supplier_name)
    if (!supplier) throw new DemoDbError('INVALID_SUPPLIER')
    const items = payload.items
    if (items.length === 0) throw new DemoDbError('RECEIPT_EMPTY')
    if (items.length > 100) throw new DemoDbError('TOO_MANY_ROWS')
    const invalid = items.some(
      (i) =>
        i.ordered_qty < 1 ||
        i.received_qty < 0 ||
        i.defective_qty < 0 ||
        i.received_qty + i.defective_qty > i.ordered_qty ||
        i.unit_cost < 0,
    )
    if (invalid) throw new DemoDbError('INVALID_RECEIPT_ITEM')
    if (new Set(items.map((i) => i.product_id)).size !== items.length) {
      throw new DemoDbError('DUPLICATE_PRODUCT')
    }
    if (
      items.some((i) => !db.products.some((p) => p.id === i.product_id && p.seller_id === sellerId))
    ) {
      throw new DemoDbError('PRODUCT_NOT_FOUND')
    }

    const header = {
      supplier_name: supplier,
      supplier_phone: clean(payload.header.supplier_phone),
      invoice_number: clean(payload.header.invoice_number),
      delivered_by: clean(payload.header.delivered_by),
      received_date: payload.header.received_date || dateKeyOf(Date.now()),
      note: clean(payload.header.note),
    }
    const now = nowIso()
    let receiptId = id
    if (receiptId === null) {
      receiptId = newId()
      db.purchase_receipts.push({
        id: receiptId,
        seller_id: sellerId,
        code: padCode('PN', nextCounter(db, 'receipt', sellerId)),
        status: 'draft',
        ...header,
        total_amount: 0,
        created_at: now,
        updated_at: now,
        posted_at: null,
      })
    } else {
      Object.assign(draftOf(db, sellerId, receiptId), header, { updated_at: now })
      db.purchase_receipt_items = db.purchase_receipt_items.filter(
        (i) => i.receipt_id !== receiptId,
      )
    }

    const rid = receiptId
    items.forEach((i, index) => {
      db.purchase_receipt_items.push({
        id: newId(),
        receipt_id: rid,
        product_id: i.product_id,
        ordered_qty: i.ordered_qty,
        received_qty: i.received_qty,
        defective_qty: i.defective_qty,
        unit_cost: round(i.unit_cost, 2),
        condition_note: clean(i.condition_note),
        position: index + 1,
      })
    })
    const receipt = db.purchase_receipts.find((r) => r.id === rid)
    if (receipt) {
      receipt.total_amount = round(
        items.reduce((sum, i) => sum + i.received_qty * round(i.unit_cost, 2), 0),
      )
    }
    return rid
  })
}

export async function postReceipt(id: string): Promise<void> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    const receipt = draftOf(db, sellerId, id)
    const lines = db.purchase_receipt_items.filter((i) => i.receipt_id === id)
    if (lines.length === 0) throw new DemoDbError('RECEIPT_EMPTY')
    const received = lines.filter((i) => i.received_qty > 0)
    if (received.length === 0) throw new DemoDbError('RECEIPT_NO_RECEIVED')

    const now = nowIso()
    for (const line of [...received].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
      const product = db.products.find((p) => p.id === line.product_id && p.seller_id === sellerId)
      if (!product) throw new DemoDbError('PRODUCT_NOT_FOUND', line.product_id)
      product.cost_price = round(
        (product.stock * product.cost_price + line.received_qty * line.unit_cost) /
          (product.stock + line.received_qty),
        2,
      )
      product.stock += line.received_qty
      db.inventory_movements.push({
        id: newId(),
        seller_id: sellerId,
        product_id: product.id,
        delta: line.received_qty,
        reason: 'purchase_receipt',
        note: null,
        order_id: null,
        receipt_id: id,
        unit_cost: line.unit_cost,
        created_at: now,
      })
    }
    Object.assign(receipt, { status: 'posted', posted_at: now, updated_at: now })
  })
}

export async function deleteReceipt(id: string): Promise<void> {
  return writeDemoDb((db) => {
    const sellerId = requireApprovedSeller(db)
    draftOf(db, sellerId, id)
    db.purchase_receipts = db.purchase_receipts.filter((r) => r.id !== id)
    db.purchase_receipt_items = db.purchase_receipt_items.filter((i) => i.receipt_id !== id)
  })
}
