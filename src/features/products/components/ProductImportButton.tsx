import { Button, FileButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconFileSpreadsheet } from '@tabler/icons-react'
import { useState } from 'react'
import { formatNumber } from '@/shared/lib/formatters'
import { useFindExistingProductNames, useLoadCategoryNames } from '../api/products.queries'
import {
  parseProductImport,
  rowLabel,
  type ImportedRow,
  type ImportResult,
} from '../lib/importProducts'
import {
  downloadImportTemplate,
  MAX_SPREADSHEET_SIZE,
  readSpreadsheet,
  SPREADSHEET_ACCEPT,
} from '../lib/spreadsheet'
import { ProductImportModal } from './ProductImportModal'

interface ImportState {
  file: File
  sheetName: string | null
  result: ImportResult
  /** Dòng có tên trùng với sản phẩm đã có — không nhập, chỉ báo lại. */
  duplicates: readonly ImportedRow[]
}

type FindExistingNames = (names: readonly string[]) => Promise<Set<string>>

/**
 * Tách dòng trùng tên với sản phẩm đã có ra khỏi danh sách nhập. Danh sách xem trước chỉ còn
 * sản phẩm mới; người dùng quyết định có thêm ngay các sản phẩm mới hay không.
 */
async function splitDuplicates(
  state: ImportState,
  findExisting: FindExistingNames,
): Promise<ImportState> {
  const { result } = state
  if (!result.ok) return state
  let existing: Set<string>
  try {
    existing = await findExisting(result.products.map((p) => p.name))
  } catch {
    return {
      ...state,
      result: {
        ok: false,
        errors: [
          'Không kiểm tra được tên sản phẩm trùng. Vui lòng kiểm tra mạng và chọn lại file.',
        ],
      },
    }
  }
  if (existing.size === 0) return state

  const duplicates = result.products.filter((p) => existing.has(p.name))
  const products = result.products.filter((p) => !existing.has(p.name))
  const duplicateRows = new Set(duplicates.map((p) => rowLabel(p.rowNumber)))
  const warnings = result.warnings.filter(
    (warning) => !duplicateRows.has(warning.slice(0, warning.indexOf(':') + 1)),
  )
  return { ...state, result: { ok: true, products, warnings }, duplicates }
}

async function analyzeFile(
  file: File,
  findExisting: FindExistingNames,
  loadCategories: () => Promise<string[]>,
): Promise<ImportState> {
  if (file.size > MAX_SPREADSHEET_SIZE) {
    const mb = formatNumber(MAX_SPREADSHEET_SIZE / 1024 / 1024)
    return {
      file,
      sheetName: null,
      result: { ok: false, errors: [`File lớn hơn ${mb} MB.`] },
      duplicates: [],
    }
  }
  let parsed: ImportState
  try {
    const [{ sheetName, rows }, categories] = await Promise.all([
      readSpreadsheet(file),
      loadCategories(),
    ])
    parsed = { file, sheetName, result: parseProductImport(rows, categories), duplicates: [] }
  } catch {
    return {
      file,
      sheetName: null,
      duplicates: [],
      result: {
        ok: false,
        errors: ['Không đọc được file. Hãy dùng file Excel (.xlsx, .xls) hoặc CSV hợp lệ.'],
      },
    }
  }
  return splitDuplicates(parsed, findExisting)
}

/** Nút "Nhập từ Excel" + "File mẫu" trên header trang Sản phẩm. */
export function ProductImportButton() {
  const [reading, setReading] = useState(false)
  const [state, setState] = useState<ImportState | null>(null)
  const findExisting = useFindExistingProductNames()
  const loadCategories = useLoadCategoryNames()

  const handleFile = async (file: File | null) => {
    if (!file) return
    setReading(true)
    try {
      setState(await analyzeFile(file, findExisting.mutateAsync, loadCategories))
    } finally {
      setReading(false)
    }
  }

  const handleDownloadTemplate = () => {
    loadCategories()
      .then(downloadImportTemplate)
      .catch(() =>
        notifications.show({
          color: 'red',
          title: 'Không tạo được file mẫu',
          message: 'Vui lòng thử lại.',
        }),
      )
  }

  return (
    <>
      <Button
        variant="subtle"
        leftSection={<IconDownload size={16} aria-hidden />}
        onClick={handleDownloadTemplate}
      >
        File mẫu
      </Button>
      <FileButton onChange={(file) => void handleFile(file)} accept={SPREADSHEET_ACCEPT}>
        {(props) => (
          <Button
            {...props}
            variant="default"
            leftSection={<IconFileSpreadsheet size={16} aria-hidden />}
            loading={reading}
          >
            Nhập từ Excel
          </Button>
        )}
      </FileButton>
      <ProductImportModal
        opened={state !== null}
        file={state?.file ?? null}
        sheetName={state?.sheetName ?? null}
        result={state?.result ?? null}
        duplicates={state?.duplicates ?? []}
        onClose={() => setState(null)}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </>
  )
}
