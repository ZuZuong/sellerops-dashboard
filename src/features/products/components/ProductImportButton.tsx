import { Button, FileButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconFileSpreadsheet } from '@tabler/icons-react'
import { useState } from 'react'
import { formatNumber } from '@/shared/lib/formatters'
import { parseProductImport, type ImportResult } from '../lib/importProducts'
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
}

async function analyzeFile(file: File): Promise<ImportState> {
  if (file.size > MAX_SPREADSHEET_SIZE) {
    const mb = formatNumber(MAX_SPREADSHEET_SIZE / 1024 / 1024)
    return { file, sheetName: null, result: { ok: false, errors: [`File lớn hơn ${mb} MB.`] } }
  }
  try {
    const { sheetName, rows } = await readSpreadsheet(file)
    return { file, sheetName, result: parseProductImport(rows) }
  } catch {
    return {
      file,
      sheetName: null,
      result: {
        ok: false,
        errors: ['Không đọc được file. Hãy dùng file Excel (.xlsx, .xls) hoặc CSV hợp lệ.'],
      },
    }
  }
}

/** Nút "Nhập từ Excel" + "File mẫu" trên header trang Sản phẩm. */
export function ProductImportButton() {
  const [reading, setReading] = useState(false)
  const [state, setState] = useState<ImportState | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setReading(true)
    try {
      setState(await analyzeFile(file))
    } finally {
      setReading(false)
    }
  }

  const handleDownloadTemplate = () => {
    downloadImportTemplate().catch(() =>
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
        onClose={() => setState(null)}
        onDownloadTemplate={handleDownloadTemplate}
      />
    </>
  )
}
