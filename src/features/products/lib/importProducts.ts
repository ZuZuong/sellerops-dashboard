import { PRODUCT_CATEGORIES, type ProductCategory } from '../constants'
import { importProductSchema, type ImportedProduct } from '../schemas/product.schema'

/** Giới hạn số dòng mỗi lần nhập — đủ cho nhu cầu shop, giữ request insert gọn. */
export const MAX_IMPORT_ROWS = 500

type ImportField = 'name' | 'category' | 'price' | 'stock' | 'low_stock_threshold' | 'description'

interface ColumnSpec {
  field: ImportField
  /** Tên cột hiển thị (dùng trong file mẫu và thông báo lỗi). */
  label: string
  required: boolean
  /** Tên cột chấp nhận, đã chuẩn hóa (không dấu, chữ thường). */
  aliases: readonly string[]
}

export const IMPORT_COLUMNS: readonly ColumnSpec[] = [
  {
    field: 'name',
    label: 'Tên sản phẩm',
    required: true,
    aliases: ['ten san pham', 'ten', 'name'],
  },
  { field: 'category', label: 'Danh mục', required: true, aliases: ['danh muc', 'category'] },
  { field: 'price', label: 'Giá bán', required: true, aliases: ['gia ban', 'gia', 'price'] },
  {
    field: 'stock',
    label: 'Tồn kho',
    required: false,
    aliases: ['ton kho', 'so luong', 'stock', 'quantity'],
  },
  {
    field: 'low_stock_threshold',
    label: 'Ngưỡng cảnh báo',
    required: false,
    aliases: ['nguong canh bao', 'nguong', 'low stock threshold'],
  },
  {
    field: 'description',
    label: 'Mô tả',
    required: false,
    aliases: ['mo ta', 'noi dung', 'description'],
  },
]

const NUMERIC_FIELDS = new Set<ImportField>(['price', 'stock', 'low_stock_threshold'])

export interface ImportedRow extends ImportedProduct {
  /** Số dòng trong file Excel (để đối chiếu). */
  rowNumber: number
}

export type ImportResult = { ok: true; products: ImportedRow[] } | { ok: false; errors: string[] }

/** "Giá bán *" / "GIÁ BÁN (VNĐ)" → "gia ban". */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const CATEGORY_BY_KEY = new Map<string, ProductCategory>(
  PRODUCT_CATEGORIES.map((category) => [normalizeHeader(category), category]),
)

/** So khớp danh mục không phân biệt hoa thường / dấu: "ao thun" → "Áo thun". */
export function matchCategory(value: unknown): ProductCategory | null {
  return CATEGORY_BY_KEY.get(normalizeHeader(value)) ?? null
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

/**
 * Ô số trong Excel có thể là number hoặc chuỗi kiểu "150.000", "150,000 ₫", "150000đ".
 * Trả về `undefined` nếu ô trống, `null` nếu không đọc được thành số nguyên.
 */
export function parseIntegerCell(value: unknown): number | null | undefined {
  if (isBlank(value)) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value)
    .replace(/\s/g, '')
    .replace(/(₫|vnđ|vnd|đ)$/i, '')
  if (/^\d+$/.test(text)) return Number(text)
  // Dấu . hoặc , phân tách hàng nghìn (đúng nhóm 3 chữ số).
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ''))
  return null
}

/**
 * Kiểm tra & chuyển các dòng đọc từ file (mảng 2 chiều) thành sản phẩm.
 * Tất cả hoặc không: chỉ cần một lỗi là trả về danh sách lỗi để người dùng sửa file.
 */
export function parseProductImport(rows: readonly (readonly unknown[])[]): ImportResult {
  const headerIndex = rows.findIndex((row) => row.some((cell) => !isBlank(cell)))
  if (headerIndex === -1) return { ok: false, errors: ['File trống, không có dòng tiêu đề.'] }

  const header = rows[headerIndex] ?? []
  const columnIndex = new Map<ImportField, number>()
  header.forEach((cell, index) => {
    const key = normalizeHeader(cell)
    const spec = IMPORT_COLUMNS.find((c) => c.aliases.includes(key))
    if (spec && !columnIndex.has(spec.field)) columnIndex.set(spec.field, index)
  })

  const missingColumns = IMPORT_COLUMNS.filter((c) => c.required && !columnIndex.has(c.field))
  if (missingColumns.length > 0) {
    return {
      ok: false,
      errors: missingColumns.map((c) => `Thiếu cột "${c.label}".`),
    }
  }

  const dataRows = rows
    .map((row, index) => ({ row, rowNumber: index + 1 }))
    .slice(headerIndex + 1)
    .filter(({ row }) => row.some((cell) => !isBlank(cell)))

  if (dataRows.length === 0) {
    return { ok: false, errors: ['File không có dòng sản phẩm nào bên dưới dòng tiêu đề.'] }
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      errors: [`File có ${dataRows.length} dòng, tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập.`],
    }
  }

  const errors: string[] = []
  const products: ImportedRow[] = []

  for (const { row, rowNumber } of dataRows) {
    const rowErrors: string[] = []
    // Trường đã báo lỗi ở bước đọc ô → không để Zod báo trùng (vd. "thiếu Giá bán").
    const reported = new Set<string>()
    const input: Record<string, unknown> = {}

    for (const spec of IMPORT_COLUMNS) {
      const index = columnIndex.get(spec.field)
      const raw = index === undefined ? undefined : row[index]

      if (NUMERIC_FIELDS.has(spec.field)) {
        const parsed = parseIntegerCell(raw)
        if (parsed === null) {
          rowErrors.push(`${spec.label} "${String(raw)}" không phải số hợp lệ`)
          reported.add(spec.field)
          continue
        }
        input[spec.field] = parsed
      } else if (spec.field === 'category') {
        if (isBlank(raw)) continue // Zod báo "Vui lòng chọn danh mục"
        const category = matchCategory(raw)
        if (!category) {
          rowErrors.push(`Danh mục "${String(raw).trim()}" không có trong danh sách`)
          reported.add(spec.field)
          continue
        }
        input.category = category
      } else {
        input[spec.field] = isBlank(raw) ? undefined : String(raw)
      }
    }

    const parsed = importProductSchema.safeParse(input)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0])
        if (reported.has(field)) continue
        reported.add(field)
        // Ô bắt buộc để trống: "Vui lòng chọn danh mục" → "thiếu Danh mục" cho dễ đọc.
        const spec = IMPORT_COLUMNS.find((c) => c.field === field)
        const missing = spec && input[field] === undefined
        rowErrors.push(missing ? `thiếu ${spec.label}` : issue.message)
      }
    }

    if (rowErrors.length > 0) errors.push(`Dòng ${rowNumber}: ${rowErrors.join('; ')}.`)
    else if (parsed.success) products.push({ ...parsed.data, rowNumber })
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, products }
}
