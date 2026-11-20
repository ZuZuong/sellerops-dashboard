/**
 * "Storage" của chế độ demo. File nhỏ (≤ 400 KB) lưu dạng data URL trong `sessionStorage` để tải
 * lại trang vẫn xem được; file lớn hơn chỉ giữ trong bộ nhớ (mất khi tải lại trang).
 * Đường dẫn không có file (dữ liệu mẫu) → ảnh minh họa có tên file.
 */
const STORAGE_PREFIX = 'sellerops.demo.file:'
const MAX_PERSISTED_BYTES = 400 * 1024

const memory = new Map<string, string>()

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'))
    reader.readAsDataURL(file)
  })
}

export async function putDemoFile(path: string, file: Blob): Promise<void> {
  if (file.size <= MAX_PERSISTED_BYTES) {
    const dataUrl = await readAsDataUrl(file)
    memory.set(path, dataUrl)
    try {
      window.sessionStorage.setItem(STORAGE_PREFIX + path, dataUrl)
    } catch {
      // Hết dung lượng: vẫn còn bản trong bộ nhớ.
    }
    return
  }
  memory.set(path, URL.createObjectURL(file))
}

export function removeDemoFiles(paths: readonly string[]): void {
  for (const path of paths) {
    const url = memory.get(path)
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    memory.delete(path)
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + path)
    } catch {
      // Bỏ qua.
    }
  }
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** Ảnh SVG thay thế cho file mẫu không có nội dung thật. */
export function demoPlaceholder(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#eef2f7"/><rect x="24" y="24" width="592" height="372" rx="16" fill="none" stroke="#94a3b8" stroke-dasharray="10 8" stroke-width="3"/><text x="320" y="196" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#334155">Tài liệu mẫu (chế độ demo)</text><text x="320" y="240" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#64748b">${escapeXml(label)}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** URL xem file: file đã tải lên trong tab, hoặc ảnh minh họa nếu là dữ liệu mẫu. */
export function getDemoFileUrl(path: string, label = path.split('/').pop() ?? path): string {
  const cached = memory.get(path)
  if (cached) return cached
  try {
    const stored = window.sessionStorage.getItem(STORAGE_PREFIX + path)
    if (stored) {
      memory.set(path, stored)
      return stored
    }
  } catch {
    // Bỏ qua.
  }
  return demoPlaceholder(label)
}
