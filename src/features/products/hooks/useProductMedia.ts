import { useCallback, useEffect, useRef, useState } from 'react'
import { getProductImageUrl } from '../api/productImages.api'
import {
  EMPTY_MEDIA,
  MAX_GALLERY_IMAGES,
  validateImageFile,
  type ProductImage,
  type ProductMedia,
} from '../lib/productImages'
import type { Product } from '../types'

function fromPath(path: string): ProductImage {
  return { key: path, path, file: null, previewUrl: getProductImageUrl(path) }
}

function fromFile(file: File): ProductImage {
  return { key: crypto.randomUUID(), path: null, file, previewUrl: URL.createObjectURL(file) }
}

function release(image: ProductImage | null) {
  if (image?.file) URL.revokeObjectURL(image.previewUrl)
}

export function initialMedia(product?: Product | null): ProductMedia {
  if (!product) return EMPTY_MEDIA
  return {
    hero: product.hero_image_path ? fromPath(product.hero_image_path) : null,
    gallery: product.image_paths.map(fromPath),
  }
}

/**
 * State ảnh của form sản phẩm (ảnh đại diện + ảnh phụ): validate file, giới hạn số ảnh phụ,
 * tạo / thu hồi object URL để không rò rỉ bộ nhớ.
 */
export function useProductMedia(product?: Product | null) {
  const [media, setMedia] = useState<ProductMedia>(() => initialMedia(product))
  const [error, setError] = useState<string | null>(null)

  // Thu hồi mọi object URL còn lại khi form đóng.
  const latest = useRef(media)
  useEffect(() => {
    latest.current = media
  }, [media])
  useEffect(
    () => () => {
      release(latest.current.hero)
      latest.current.gallery.forEach(release)
    },
    [],
  )

  /** Lọc file hợp lệ; ghi lỗi của file đầu tiên bị từ chối. */
  const accept = useCallback((files: readonly File[]) => {
    const errors = files.map(validateImageFile).filter((e): e is string => e !== null)
    setError(errors[0] ?? null)
    return files.filter((file) => validateImageFile(file) === null)
  }, [])

  // Tạo object URL / gọi setError ngoài updater của setMedia: StrictMode gọi updater hai lần.
  const setHero = useCallback(
    (files: readonly File[]) => {
      const [file] = accept(files)
      if (!file) return
      release(media.hero)
      const hero = fromFile(file)
      setMedia((prev) => ({ ...prev, hero }))
    },
    [accept, media.hero],
  )

  const addGallery = useCallback(
    (files: readonly File[]) => {
      const valid = accept(files)
      if (valid.length === 0) return
      const room = Math.max(0, MAX_GALLERY_IMAGES - media.gallery.length)
      if (valid.length > room) setError(`Tối đa ${MAX_GALLERY_IMAGES} ảnh phụ.`)
      const added = valid.slice(0, room).map(fromFile)
      if (added.length > 0) setMedia((prev) => ({ ...prev, gallery: [...prev.gallery, ...added] }))
    },
    [accept, media.gallery.length],
  )

  /** Dán ảnh (Ctrl+V): ảnh đầu tiên làm ảnh đại diện nếu chưa có, còn lại vào ảnh phụ. */
  const addPasted = useCallback(
    (files: readonly File[]) => {
      if (files.length === 0) return
      if (media.hero) {
        addGallery(files)
        return
      }
      const [first, ...rest] = files
      if (first) setHero([first])
      if (rest.length > 0) addGallery(rest)
    },
    [addGallery, media.hero, setHero],
  )

  const removeHero = useCallback(() => {
    release(media.hero)
    setMedia((prev) => ({ ...prev, hero: null }))
  }, [media.hero])

  const removeGalleryImage = useCallback(
    (key: string) => {
      release(media.gallery.find((image) => image.key === key) ?? null)
      setMedia((prev) => ({ ...prev, gallery: prev.gallery.filter((image) => image.key !== key) }))
    },
    [media.gallery],
  )

  return {
    media,
    error,
    setError,
    setHero,
    addGallery,
    addPasted,
    removeHero,
    removeGalleryImage,
  }
}

export type ProductMediaState = ReturnType<typeof useProductMedia>
