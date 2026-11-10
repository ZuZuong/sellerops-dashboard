import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductImage } from '../lib/productImages'

const storage = {
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn/${path}` } })),
}

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })) },
    storage: { from: () => storage },
  },
}))

const { uploadProductMedia, IMAGE_UPLOAD_FAILED } = await import('./productImages.api')

const newImage = (name: string): ProductImage => ({
  key: name,
  path: null,
  file: new File(['x'], name, { type: 'image/png' }),
  previewUrl: `blob:${name}`,
})
const savedImage = (path: string): ProductImage => ({
  key: path,
  path,
  file: null,
  previewUrl: '',
})

beforeEach(() => {
  storage.upload.mockReset().mockResolvedValue({ error: null })
  storage.remove.mockReset().mockResolvedValue({ error: null })
})

describe('uploadProductMedia', () => {
  it('chỉ tải ảnh mới vào thư mục của user, giữ ảnh cũ và thứ tự', async () => {
    const result = await uploadProductMedia({
      hero: newImage('hero.png'),
      gallery: [savedImage('user-1/old.jpg'), newImage('side.png')],
    })

    expect(storage.upload).toHaveBeenCalledTimes(2)
    for (const [path] of storage.upload.mock.calls) {
      expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.png$/)
    }
    expect(result.hero_image_path).toBe(result.uploaded[0])
    expect(result.image_paths).toEqual(['user-1/old.jpg', result.uploaded[1]])
  })

  it('không có ảnh mới → không gọi Storage', async () => {
    const result = await uploadProductMedia({ hero: null, gallery: [savedImage('user-1/a.jpg')] })
    expect(storage.upload).not.toHaveBeenCalled()
    expect(result).toEqual({ hero_image_path: null, image_paths: ['user-1/a.jpg'], uploaded: [] })
  })

  it('một ảnh lỗi → xóa các ảnh đã tải lên trong lần này và báo IMAGE_UPLOAD_FAILED', async () => {
    storage.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Payload too large' } })

    await expect(
      uploadProductMedia({ hero: newImage('a.png'), gallery: [newImage('b.png')] }),
    ).rejects.toThrow(IMAGE_UPLOAD_FAILED)

    const firstPath = storage.upload.mock.calls[0]?.[0]
    expect(storage.remove).toHaveBeenCalledWith([firstPath])
  })
})
