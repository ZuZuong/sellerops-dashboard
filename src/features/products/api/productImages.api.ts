import { supabase } from '@/shared/lib/supabase'
import { imageExtension, type ProductImage, type ProductMedia } from '../lib/productImages'

export const PRODUCT_IMAGES_BUCKET = 'product-images'

/** Lỗi nghiệp vụ phía client, map sang tiếng Việt trong `productErrors`. */
export const IMAGE_UPLOAD_FAILED = 'IMAGE_UPLOAD_FAILED'

/** URL public của ảnh (bucket public, không gọi mạng — chỉ ghép URL). */
export function getProductImageUrl(path: string): string {
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Tải một file lên `<seller_id>/<uuid>.<ext>`: RLS Storage chỉ cho shop đã duyệt ghi vào thư mục
 * của chính shop, CHECK `paths_owned_by` trên products bảo đảm sản phẩm chỉ trỏ tới ảnh của shop.
 */
async function uploadImage(sellerId: string, file: File): Promise<string> {
  const path = `${sellerId}/${crypto.randomUUID()}.${imageExtension(file)}`
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(IMAGE_UPLOAD_FAILED, { cause: error })
  return path
}

/** Xóa file ảnh. Dùng để dọn dẹp nên không ném lỗi — file mồ côi không ảnh hưởng nghiệp vụ. */
export async function removeProductImages(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([...paths])
}

export interface UploadedMedia {
  hero_image_path: string | null
  image_paths: string[]
  /** Các file vừa tải lên trong lần này — để dọn nếu bước lưu sản phẩm thất bại. */
  uploaded: string[]
}

/**
 * Tải các ảnh mới (song song) và trả về đường dẫn cuối cùng cho sản phẩm.
 * Nếu một ảnh lỗi, các ảnh đã lên trong lần này bị xóa để không để lại file rác.
 */
export async function uploadProductMedia(
  sellerId: string,
  media: ProductMedia,
): Promise<UploadedMedia> {
  const images = [media.hero, ...media.gallery].filter((i): i is ProductImage => i !== null)
  const pending = images.filter((image) => image.file !== null)

  const results = await Promise.allSettled(
    pending.map((image) => uploadImage(sellerId, image.file as File)),
  )
  const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed) {
    await removeProductImages(uploaded)
    throw failed.reason
  }

  const pathByKey = new Map(pending.map((image, i) => [image.key, uploaded[i] ?? null]))
  const resolve = (image: ProductImage) => image.path ?? pathByKey.get(image.key) ?? null

  return {
    hero_image_path: media.hero ? resolve(media.hero) : null,
    image_paths: media.gallery.map(resolve).filter((p): p is string => p !== null),
    uploaded,
  }
}
