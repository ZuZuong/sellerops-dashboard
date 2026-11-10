import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Code,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ClipboardEvent } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { useCreateProduct, useUpdateProduct } from '../api/products.queries'
import { isProductCategory, PRODUCT_CATEGORIES } from '../constants'
import { useProductMedia } from '../hooks/useProductMedia'
import { getClipboardImageFiles } from '../lib/productImages'
import { previewSku } from '../lib/sku'
import {
  EMPTY_PRODUCT_FORM,
  MAX_DESCRIPTION,
  productSchema,
  type ProductFormInput,
  type ProductFormValues,
} from '../schemas/product.schema'
import type { Product } from '../types'
import { ProductImagesField } from './ProductImagesField'

interface ProductFormModalProps {
  opened: boolean
  onClose: () => void
  /** Có `product` → chế độ sửa; không có → tạo mới. */
  product?: Product | null
}

export function ProductFormModal({ opened, onClose, product }: ProductFormModalProps) {
  const isMobile = useMediaQuery('(max-width: 36em)')
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      size="xl"
      fullScreen={isMobile}
      centered
    >
      {/* key: mở sản phẩm khác → form khởi tạo lại với giá trị mới */}
      {opened && <ProductForm key={product?.id ?? 'new'} product={product} onDone={onClose} />}
    </Modal>
  )
}

function toFormInput(product: Product): Partial<ProductFormInput> {
  return {
    name: product.name,
    // Danh mục cũ (nhập tay trước đây) không còn trong danh sách → buộc chọn lại.
    category: isProductCategory(product.category) ? product.category : undefined,
    price: product.price,
    stock: product.stock,
    low_stock_threshold: product.low_stock_threshold,
    description: product.description ?? '',
    is_active: product.is_active,
  }
}

interface ProductFormProps {
  product?: Product | null
  onDone: () => void
}

export function ProductForm({ product, onDone }: ProductFormProps) {
  const isEdit = Boolean(product)
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isSubmitting = createProduct.isPending || updateProduct.isPending
  const mediaState = useProductMedia(product)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? toFormInput(product) : EMPTY_PRODUCT_FORM,
  })
  const name = useWatch({ control, name: 'name' })
  const description = useWatch({ control, name: 'description' })

  /** Tạo mới: `publish` quyết định đăng bán ngay hay chỉ lưu. Sửa: giữ nguyên trạng thái. */
  const submit = (publish: boolean) =>
    handleSubmit((values) => {
      const media = mediaState.media
      if (product) {
        updateProduct.mutate({ product, values, media }, { onSuccess: onDone })
      } else {
        createProduct.mutate(
          { values: { ...values, is_active: publish }, media },
          { onSuccess: onDone },
        )
      }
    })

  // Ctrl+V ảnh ở bất kỳ đâu trong form (kể cả khi đang ở ô nhập tên) → thêm vào ô ảnh.
  // Dán chữ không bị ảnh hưởng vì clipboard khi đó không có file.
  const handlePaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const files = getClipboardImageFiles(event.clipboardData)
    if (files.length === 0) return
    event.preventDefault()
    mediaState.addPasted(files)
  }

  return (
    <form
      // Enter trong form = hành động chính (Lưu thay đổi / Đăng sản phẩm).
      onSubmit={submit(true)}
      onPaste={handlePaste}
      noValidate
      aria-label={isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
    >
      <Stack gap="md">
        <TextInput
          label="Tên sản phẩm"
          placeholder="VD: Áo thun cotton basic"
          withAsterisk
          data-autofocus
          error={errors.name?.message}
          {...register('name')}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Danh mục"
                placeholder="Chọn danh mục"
                data={PRODUCT_CATEGORIES}
                value={field.value ?? null}
                onChange={(value) => field.onChange(value ?? undefined)}
                onBlur={field.onBlur}
                ref={field.ref}
                searchable
                nothingFoundMessage="Không có danh mục phù hợp"
                withAsterisk
                error={errors.category?.message}
              />
            )}
          />
          <SkuField sku={product?.sku} name={name ?? ''} />
        </SimpleGrid>

        {/* Mô tả phụ đặt DƯỚI ô nhập để 3 ô luôn thẳng hàng dù ô nào có / không có mô tả. */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" style={{ alignItems: 'start' }}>
          <IntegerField
            control={control}
            name="price"
            label="Giá bán"
            placeholder="VD: 150.000"
            suffix=" ₫"
            error={errors.price?.message}
            withAsterisk
          />
          <IntegerField
            control={control}
            name="stock"
            label={isEdit ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu'}
            placeholder="0"
            description={isEdit ? 'Dùng "sửa nhanh" để điều chỉnh' : 'Bỏ trống = 0'}
            disabled={isEdit}
            error={errors.stock?.message}
          />
          <IntegerField
            control={control}
            name="low_stock_threshold"
            label="Ngưỡng cảnh báo"
            description="Cảnh báo khi tồn ≤ ngưỡng"
            error={errors.low_stock_threshold?.message}
          />
        </SimpleGrid>

        <Textarea
          label="Mô tả sản phẩm"
          placeholder="Chất liệu, kích cỡ, hướng dẫn bảo quản…"
          autosize
          minRows={4}
          maxRows={12}
          description={`${(description ?? '').length}/${MAX_DESCRIPTION} ký tự`}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          error={errors.description?.message}
          {...register('description')}
        />

        <ProductImagesField state={mediaState} />

        <Group justify="flex-end" gap="sm" mt="sm" wrap="wrap">
          <Button variant="default" onClick={onDone} disabled={isSubmitting}>
            Hủy
          </Button>
          {isEdit ? (
            <Button type="submit" loading={isSubmitting}>
              Lưu thay đổi
            </Button>
          ) : (
            <>
              <Tooltip
                label="Lưu sản phẩm nhưng chưa đăng bán"
                events={{ hover: true, focus: true, touch: true }}
              >
                <Button
                  variant="light"
                  onClick={submit(false)}
                  disabled={isSubmitting}
                  aria-description="Lưu sản phẩm nhưng chưa đăng bán"
                >
                  Thêm sản phẩm
                </Button>
              </Tooltip>
              <Button type="submit" loading={isSubmitting}>
                Đăng sản phẩm
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </form>
  )
}

/** SKU chỉ đọc: tạo mới thì xem trước mẫu, sửa thì hiện SKU thật (cố định). */
function SkuField({ sku, name }: { sku?: string; name: string }) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500} component="span" id="sku-label">
        SKU
      </Text>
      <Code aria-labelledby="sku-label" fz="sm" py={7} px="sm" style={{ overflowWrap: 'anywhere' }}>
        {sku ?? previewSku(name)}
      </Code>
      <Text size="xs" c="dimmed">
        {sku ? 'SKU cố định sau khi tạo' : 'Tự động tạo khi lưu (### là số thứ tự)'}
      </Text>
    </Stack>
  )
}

interface IntegerFieldProps {
  control: Control<ProductFormInput, unknown, ProductFormValues>
  name: 'price' | 'stock' | 'low_stock_threshold'
  label: string
  placeholder?: string
  description?: string
  suffix?: string
  error?: string
  disabled?: boolean
  withAsterisk?: boolean
}

/**
 * NumberInput số nguyên không âm. Ô trống giữ là trống (không tự điền 0) và không cho số 0 đứng đầu;
 * ô trống → undefined để Zod báo "Vui lòng nhập ..." hoặc áp giá trị mặc định.
 */
function IntegerField({ control, name, ...props }: IntegerFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NumberInput
          {...props}
          // Nhãn → ô nhập → mô tả → lỗi: ô nhập của 3 cột luôn cùng một hàng ngang.
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={field.value ?? ''}
          onChange={(value) => field.onChange(typeof value === 'number' ? value : undefined)}
          onBlur={field.onBlur}
          ref={field.ref}
          min={0}
          allowNegative={false}
          allowDecimal={false}
          allowLeadingZeros={false}
          thousandSeparator="."
          decimalSeparator=","
        />
      )}
    />
  )
}
