import {
  ActionIcon,
  AspectRatio,
  Box,
  Group,
  Image,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { IconPhotoPlus, IconPlus, IconX } from '@tabler/icons-react'
import type { ClipboardEvent } from 'react'
import { formatNumber } from '@/shared/lib/formatters'
import type { ProductMediaState } from '../hooks/useProductMedia'
import {
  getClipboardImageFiles,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_SIZE,
  PRODUCT_IMAGE_TYPES,
  type ProductImage,
} from '../lib/productImages'

const ACCEPT = [...PRODUCT_IMAGE_TYPES]
const SIZE_HINT = `JPG, PNG, WEBP · tối đa ${formatNumber(MAX_IMAGE_SIZE / 1024 / 1024)} MB`

/** Dán ảnh khi ô đang được focus (Tab tới ô rồi Ctrl+V). */
function pasteInto(handler: (files: File[]) => void) {
  return (event: ClipboardEvent) => {
    const files = getClipboardImageFiles(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    event.stopPropagation() // không để form xử lý lần nữa
    handler(files)
  }
}

export function ProductImagesField({ state }: { state: ProductMediaState }) {
  const { media, error, setHero, addGallery, removeHero, removeGalleryImage } = state
  const galleryFull = media.gallery.length >= MAX_GALLERY_IMAGES

  return (
    <Stack gap="xs">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Input.Wrapper
          label="Ảnh đại diện (hero)"
          description="Kéo thả, bấm để chọn hoặc dán ảnh (Ctrl+V)"
        >
          <Box mt={6} onPaste={pasteInto(setHero)}>
            {media.hero ? (
              <Thumbnail
                image={media.hero}
                ratio={1}
                alt="Ảnh đại diện sản phẩm"
                removeLabel="Xóa ảnh đại diện"
                onRemove={removeHero}
              />
            ) : (
              <AspectRatio ratio={1}>
                <ImageDropzone
                  label="Chọn ảnh đại diện"
                  multiple={false}
                  onDrop={setHero}
                  hint={SIZE_HINT}
                />
              </AspectRatio>
            )}
          </Box>
        </Input.Wrapper>

        <Input.Wrapper
          label={`Ảnh phụ (${media.gallery.length}/${MAX_GALLERY_IMAGES})`}
          description="Ảnh chi tiết, góc chụp khác…"
        >
          <SimpleGrid cols={3} spacing="xs" mt={6} onPaste={pasteInto(addGallery)}>
            {media.gallery.map((image, index) => (
              <Thumbnail
                key={image.key}
                image={image}
                ratio={1}
                alt={`Ảnh phụ ${index + 1}`}
                removeLabel={`Xóa ảnh phụ ${index + 1}`}
                onRemove={() => removeGalleryImage(image.key)}
              />
            ))}
            {!galleryFull && (
              <AspectRatio ratio={1}>
                <ImageDropzone label="Thêm ảnh phụ" multiple onDrop={addGallery} compact />
              </AspectRatio>
            )}
          </SimpleGrid>
        </Input.Wrapper>
      </SimpleGrid>
      {error && (
        <Text size="sm" c="red" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  )
}

interface ImageDropzoneProps {
  label: string
  multiple: boolean
  onDrop: (files: File[]) => void
  hint?: string
  compact?: boolean
}

function ImageDropzone({ label, multiple, onDrop, hint, compact = false }: ImageDropzoneProps) {
  return (
    <Dropzone
      onDrop={onDrop}
      // Kiểm tra kích thước / định dạng ở useProductMedia để có thông báo tiếng Việt thống nhất.
      onReject={(rejections) => onDrop(rejections.map((r) => r.file))}
      accept={ACCEPT}
      multiple={multiple}
      aria-label={label}
      p="xs"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Stack align="center" gap={4} ta="center" style={{ pointerEvents: 'none' }}>
        {compact ? (
          <IconPlus size={22} stroke={1.5} aria-hidden />
        ) : (
          <IconPhotoPlus size={32} stroke={1.5} aria-hidden />
        )}
        {!compact && (
          <>
            <Text size="sm" fw={500}>
              Kéo thả hoặc bấm để chọn
            </Text>
            <Text size="xs" c="dimmed">
              Có thể dán ảnh bằng Ctrl+V
            </Text>
            {hint && (
              <Text size="xs" c="dimmed">
                {hint}
              </Text>
            )}
          </>
        )}
      </Stack>
    </Dropzone>
  )
}

interface ThumbnailProps {
  image: ProductImage
  ratio: number
  alt: string
  removeLabel: string
  onRemove: () => void
}

function Thumbnail({ image, ratio, alt, removeLabel, onRemove }: ThumbnailProps) {
  return (
    <Box pos="relative">
      <AspectRatio ratio={ratio}>
        <Image src={image.previewUrl} alt={alt} radius="sm" fit="cover" />
      </AspectRatio>
      <Group pos="absolute" top={4} right={4}>
        <ActionIcon
          size="sm"
          radius="xl"
          color="dark"
          variant="filled"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Box>
  )
}
