import { formatCurrency } from '@/shared/lib/formatters'
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  type ProductCategory,
  type ProductUnit,
} from '../constants'
import { importProductSchema, type ImportedProduct } from '../schemas/product.schema'

/** Giới hạn số dòng mỗi lần nhập — đủ cho nhu cầu shop, giữ request insert gọn. */
export const MAX_IMPORT_ROWS = 500

type ImportField =
  | 'name'
  | 'category'
  | 'unit'
  | 'cost_price'
  | 'price'
  | 'stock'
  | 'low_stock_threshold'
  | 'description'

interface ColumnSpec {
  field: ImportField
  /** Tên cột hiển thị (dùng trong file mẫu và thông báo lỗi). */
  label: string
  required: boolean
  /** Tên cột chấp nhận, đã chuẩn hóa (không dấu, chữ thường). */
  aliases: readonly string[]
  /** Hướng dẫn trong sheet "Hướng dẫn" của file mẫu. */
  format: string
  example: string | number
  width: number
}

/**
 * Cột của file Excel nhập sản phẩm — thứ tự này cũng là thứ tự cột trong file mẫu.
 * Tên cột được so khớp không phân biệt hoa thường / dấu, chấp nhận vài tên thường gặp.
 */
export const IMPORT_COLUMNS: readonly ColumnSpec[] = [
  {
    field: 'name',
    label: 'Tên sản phẩm',
    required: true,
    aliases: ['ten san pham', 'ten hang', 'ten', 'name'],
    format: 'Chữ, tối đa 200 ký tự',
    example: 'Áo thun cotton basic',
    width: 32,
  },
  {
    field: 'category',
    label: 'Danh mục',
    required: true,
    aliases: ['danh muc', 'nhom hang', 'category'],
    format: 'Chọn đúng 1 tên trong sheet "Danh mục"',
    example: 'Áo thun',
    width: 16,
  },
  {
    field: 'unit',
    label: 'Đơn vị tính',
    required: true,
    aliases: ['don vi tinh', 'dvt', 'don vi', 'unit'],
    format: 'Chọn 1 giá trị trong sheet "Đơn vị tính"',
    example: 'Cái',
    width: 12,
  },
  {
    field: 'cost_price',
    label: 'Giá vốn',
    required: true,
    aliases: ['gia von', 'gia nhap', 'don gia nhap', 'cost', 'cost price'],
    format: 'Số nguyên VND, không âm (giá nhập 1 đơn vị, chưa VAT)',
    example: 90000,
    width: 14,
  },
  {
    field: 'price',
    label: 'Giá bán',
    required: true,
    aliases: ['gia ban', 'gia', 'price'],
    format: 'Số nguyên VND, không âm',
    example: 150000,
    width: 14,
  },
  {
    field: 'stock',
    label: 'Tồn đầu kỳ',
    required: false,
    aliases: ['ton dau ky', 'ton kho', 'so luong', 'stock', 'quantity'],
    format: 'Số nguyên ≥ 0. Bỏ trống = 0',
    example: 50,
    width: 12,
  },
  {
    field: 'low_stock_threshold',
    label: 'Ngưỡng cảnh báo',
    required: false,
    aliases: ['nguong canh bao', 'nguong', 'ton toi thieu', 'low stock threshold'],
    format: 'Số nguyên ≥ 0. Bỏ trống = 5',
    example: 5,
    width: 16,
  },
  {
    field: 'description',
    label: 'Mô tả',
    required: false,
    aliases: ['mo ta', 'noi dung', 'description'],
    format: 'Chữ, tối đa 5000 ký tự',
    example: 'Chất liệu cotton 100%, form regular',
    width: 40,
  },
]

const NUMERIC_FIELDS = new Set<ImportField>(['cost_price', 'price', 'stock', 'low_stock_threshold'])

export interface ImportedRow extends ImportedProduct {
  /** Số dòng trong file Excel (để đối chiếu). */
  rowNumber: number
}

export type ImportResult =
  | {
      ok: true
      products: ImportedRow[]
      /** Không chặn việc nhập nhưng cần người dùng xem lại (vd. giá bán thấp hơn giá vốn). */
      warnings: string[]
    }
  | { ok: false; errors: string[] }

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

const UNIT_BY_KEY = new Map<string, ProductUnit>(
  PRODUCT_UNITS.map((unit) => [normalizeHeader(unit), unit]),
)

/** So khớp đơn vị tính: "cai" → "Cái", "DOI" → "Đôi". */
export function matchUnit(value: unknown): ProductUnit | null {
  return UNIT_BY_KEY.get(normalizeHeader(value)) ?? null
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
  const warnings: string[] = []
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
      } else if (spec.field === 'unit') {
        if (isBlank(raw)) continue
        const unit = matchUnit(raw)
        if (!unit) {
          rowErrors.push(`Đơn vị tính "${String(raw).trim()}" không có trong danh sách`)
          reported.add(spec.field)
          continue
        }
        input.unit = unit
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
    else if (parsed.success) {
      products.push({ ...parsed.data, rowNumber })
      if (parsed.data.price < parsed.data.cost_price) {
        warnings.push(
          `Dòng ${rowNumber}: giá bán ${formatCurrency(parsed.data.price)} thấp hơn giá vốn ${formatCurrency(parsed.data.cost_price)} (bán lỗ).`,
        )
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, products, warnings }
}
