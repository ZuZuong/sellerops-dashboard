import { describe, expect, it } from 'vitest'
import {
  getClipboardImageFiles,
  imageExtension,
  MAX_IMAGE_SIZE,
  mediaPaths,
  validateImageFile,
  type ProductImage,
} from './productImages'

const file = (name: string, type: string, size = 1000) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const image = (path: string | null): ProductImage => ({
  key: path ?? 'new',
  path,
  file: null,
  previewUrl: '',
})

describe('validateImageFile', () => {
  it('chấp nhận JPG / PNG / WEBP trong giới hạn dung lượng', () => {
    expect(validateImageFile(file('a.jpg', 'image/jpeg'))).toBeNull()
    expect(validateImageFile(file('a.png', 'image/png'))).toBeNull()
    expect(validateImageFile(file('a.webp', 'image/webp', MAX_IMAGE_SIZE))).toBeNull()
  })

  it('từ chối định dạng khác và file quá lớn', () => {
    expect(validateImageFile(file('a.gif', 'image/gif'))).toMatch(/không phải ảnh JPG, PNG/)
    expect(validateImageFile(file('a.pdf', 'application/pdf'))).toMatch(/"a.pdf"/)
    expect(validateImageFile(file('big.jpg', 'image/jpeg', MAX_IMAGE_SIZE + 1))).toMatch(
      /vượt quá 5 MB/,
    )
  })
})

describe('helpers', () => {
  it('đuôi file theo MIME type', () => {
    expect(imageExtension(file('x', 'image/png'))).toBe('png')
    expect(imageExtension(file('x.jpeg', 'image/jpeg'))).toBe('jpg')
    expect(imageExtension(file('x', 'image/webp'))).toBe('webp')
  })

  it('mediaPaths: chỉ lấy ảnh đã có đường dẫn, ảnh đại diện trước', () => {
    expect(
      mediaPaths({ hero: image('u/h.jpg'), gallery: [image(null), image('u/1.jpg')] }),
    ).toEqual(['u/h.jpg', 'u/1.jpg'])
    expect(mediaPaths({ hero: null, gallery: [] })).toEqual([])
  })

  it('getClipboardImageFiles chỉ lấy file ảnh', () => {
    const data = { files: [file('a.png', 'image/png'), file('a.txt', 'text/plain')] }
    expect(getClipboardImageFiles(data as unknown as DataTransfer)).toHaveLength(1)
    expect(getClipboardImageFiles(null)).toEqual([])
  })
})
