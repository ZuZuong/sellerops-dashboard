import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { Controller, useForm } from 'react-hook-form'
import type { Seller } from '@/features/sellers'
import {
  BUSINESS_TYPE_OPTIONS,
  businessInfoSchema,
  MAIN_CATEGORY_OPTIONS,
  type BusinessInfoInput,
  type BusinessInfoValues,
} from '../schemas/application.schema'
import { StepFooter } from './StepFooter'

interface BusinessInfoStepProps {
  seller: Seller
  /** Email đăng nhập — gợi ý sẵn cho email liên hệ khi hồ sơ chưa có. */
  accountEmail: string
  saving: boolean
  onSaveDraft: (values: Partial<BusinessInfoValues>) => void
  onNext: (values: BusinessInfoValues) => void
}

function toFormInput(seller: Seller, accountEmail: string): Partial<BusinessInfoInput> {
  return {
    shop_name: seller.shop_name ?? '',
    business_type: seller.business_type ?? undefined,
    business_name: seller.business_name ?? '',
    tax_code: seller.tax_code ?? '',
    license_number: seller.license_number ?? '',
    address: seller.address ?? '',
    representative_name: seller.representative_name ?? '',
    representative_phone: seller.representative_phone ?? '',
    contact_email: seller.contact_email ?? accountEmail,
    main_category: seller.main_category ?? '',
  }
}

/** Chỉ giữ các trường đã điền hợp lệ — "Lưu nháp" không bắt điền đủ mà cũng không gửi giá trị sai. */
function validDraftFields(values: Partial<BusinessInfoInput>): Partial<BusinessInfoValues> {
  const draft: Record<string, unknown> = {}
  for (const [field, schema] of Object.entries(businessInfoSchema.shape)) {
    const parsed = schema.safeParse(values[field as keyof BusinessInfoInput])
    if (parsed.success) draft[field] = parsed.data
  }
  return draft as Partial<BusinessInfoValues>
}

/** Bước 1 — thông tin doanh nghiệp. */
export function BusinessInfoStep({
  seller,
  accountEmail,
  saving,
  onSaveDraft,
  onNext,
}: BusinessInfoStepProps) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<BusinessInfoInput, unknown, BusinessInfoValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: toFormInput(seller, accountEmail),
  })

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate aria-label="Thông tin doanh nghiệp">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Tên shop"
            placeholder="VD: Thời trang An Nhiên"
            withAsterisk
            data-autofocus
            error={errors.shop_name?.message}
            {...register('shop_name')}
          />
          <Controller
            control={control}
            name="business_type"
            render={({ field }) => (
              <Select
                label="Loại hình kinh doanh"
                placeholder="Chọn loại hình"
                data={BUSINESS_TYPE_OPTIONS}
                value={field.value ?? null}
                onChange={(value) => field.onChange(value ?? undefined)}
                onBlur={field.onBlur}
                ref={field.ref}
                allowDeselect={false}
                withAsterisk
                error={errors.business_type?.message}
              />
            )}
          />
          <TextInput
            label="Tên doanh nghiệp / hộ kinh doanh"
            description="Đúng như trên giấy phép kinh doanh"
            withAsterisk
            error={errors.business_name?.message}
            {...register('business_name')}
          />
          <Controller
            control={control}
            name="main_category"
            render={({ field }) => (
              <Select
                label="Ngành hàng chính"
                placeholder="Chọn ngành hàng"
                data={MAIN_CATEGORY_OPTIONS}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                ref={field.ref}
                allowDeselect={false}
                withAsterisk
                error={errors.main_category?.message}
              />
            )}
          />
          <TextInput
            label="Mã số thuế"
            placeholder="10 chữ số"
            inputMode="numeric"
            withAsterisk
            error={errors.tax_code?.message}
            {...register('tax_code')}
          />
          <TextInput
            label="Số giấy phép kinh doanh"
            withAsterisk
            error={errors.license_number?.message}
            {...register('license_number')}
          />
        </SimpleGrid>
        <Textarea
          label="Địa chỉ kinh doanh"
          autosize
          minRows={2}
          maxRows={4}
          withAsterisk
          error={errors.address?.message}
          {...register('address')}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <TextInput
            label="Người đại diện"
            withAsterisk
            error={errors.representative_name?.message}
            {...register('representative_name')}
          />
          <TextInput
            label="SĐT người đại diện"
            type="tel"
            placeholder="0912345678"
            withAsterisk
            error={errors.representative_phone?.message}
            {...register('representative_phone')}
          />
          <TextInput
            label="Email liên hệ"
            type="email"
            withAsterisk
            error={errors.contact_email?.message}
            {...register('contact_email')}
          />
        </SimpleGrid>

        <StepFooter
          loading={saving}
          extra={
            <Button
              variant="default"
              leftSection={<IconDeviceFloppy size={16} aria-hidden />}
              onClick={() => onSaveDraft(validDraftFields(getValues()))}
              disabled={saving}
            >
              Lưu nháp
            </Button>
          }
        />
      </Stack>
    </form>
  )
}
