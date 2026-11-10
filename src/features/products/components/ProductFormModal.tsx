import { zodResolver } from '@hookform/resolvers/zod'
import {
  Autocomplete,
  Button,
  Group,
  Modal,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Controller, useForm, type Control } from 'react-hook-form'
import { useCreateProduct, useProductCategories, useUpdateProduct } from '../api/products.queries'
import { isDuplicateSkuError } from '../lib/productErrors'
import {
  EMPTY_PRODUCT_FORM,
  productSchema,
  type ProductFormInput,
  type ProductFormValues,
} from '../schemas/product.schema'
import type { Product } from '../types'

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
      size="lg"
      fullScreen={isMobile}
      centered
    >
      {/* key: mở sản phẩm khác → form khởi tạo lại với giá trị mới */}
      {opened && <ProductForm key={product?.id ?? 'new'} product={product} onDone={onClose} />}
    </Modal>
  )
}

function toFormInput(product: Product): ProductFormInput {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category ?? '',
    price: product.price,
    stock: product.stock,
    low_stock_threshold: product.low_stock_threshold,
    is_active: product.is_active,
  }
}

interface ProductFormProps {
  product?: Product | null
  onDone: () => void
}

export function ProductForm({ product, onDone }: ProductFormProps) {
  const isEdit = Boolean(product)
  const categories = useProductCategories()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isSubmitting = createProduct.isPending || updateProduct.isPending

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? toFormInput(product) : EMPTY_PRODUCT_FORM,
  })

  const onSubmit = (values: ProductFormValues) => {
    const options = {
      onSuccess: onDone,
      onError: (error: unknown) => {
        if (isDuplicateSkuError(error)) {
          setError('sku', { message: 'SKU đã tồn tại' }, { shouldFocus: true })
        }
      },
    }
    if (product) updateProduct.mutate({ id: product.id, values }, options)
    else createProduct.mutate(values, options)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
    >
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="SKU"
            placeholder="VD: AT-001"
            description="Chữ không dấu, số, - _ . (tự chuyển in hoa)"
            withAsterisk
            autoComplete="off"
            data-autofocus
            error={errors.sku?.message}
            {...register('sku')}
          />
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Autocomplete
                label="Danh mục"
                placeholder="VD: Áo thun"
                description="Chọn có sẵn hoặc nhập danh mục mới"
                data={categories.data ?? []}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.category?.message}
              />
            )}
          />
        </SimpleGrid>

        <TextInput
          label="Tên sản phẩm"
          placeholder="VD: Áo thun cotton basic"
          withAsterisk
          error={errors.name?.message}
          {...register('name')}
        />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <IntegerField
            control={control}
            name="price"
            label="Giá bán"
            suffix=" ₫"
            error={errors.price?.message}
            withAsterisk
          />
          <IntegerField
            control={control}
            name="stock"
            label={isEdit ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu'}
            description={isEdit ? 'Dùng "sửa nhanh" để điều chỉnh' : undefined}
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

        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              label="Đang bán"
              description="Sản phẩm ngừng bán không thể thêm vào đơn hàng mới"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />

        <Group justify="flex-end" gap="sm" mt="sm">
          <Button variant="default" onClick={onDone} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

interface IntegerFieldProps {
  control: Control<ProductFormInput, unknown, ProductFormValues>
  name: 'price' | 'stock' | 'low_stock_threshold'
  label: string
  description?: string
  suffix?: string
  error?: string
  disabled?: boolean
  withAsterisk?: boolean
}

/** NumberInput số nguyên không âm; ô trống → undefined để Zod báo "Vui lòng nhập ...". */
function IntegerField({ control, name, ...props }: IntegerFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NumberInput
          {...props}
          value={field.value ?? ''}
          onChange={(value) => field.onChange(typeof value === 'number' ? value : undefined)}
          onBlur={field.onBlur}
          ref={field.ref}
          min={0}
          allowNegative={false}
          allowDecimal={false}
          thousandSeparator="."
          decimalSeparator=","
        />
      )}
    />
  )
}
