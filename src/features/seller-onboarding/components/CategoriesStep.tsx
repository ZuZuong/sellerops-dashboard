import { Alert, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { CategoryManager, useCategories } from '@/features/categories'
import { categoriesStepSchema } from '../schemas/application.schema'
import { StepFooter } from './StepFooter'

interface CategoriesStepProps {
  saving: boolean
  onBack: () => void
  onNext: () => void
}

/**
 * Bước 3 — seller tự tạo danh mục sản phẩm của shop (không có danh mục mẫu), tối thiểu 1.
 * Dùng chung `CategoryManager` với trang /seller/categories.
 */
export function CategoriesStep({ saving, onBack, onNext }: CategoriesStepProps) {
  const categories = useCategories()
  const [error, setError] = useState<string | null>(null)
  const count = categories.data?.length ?? 0

  const handleNext = () => {
    const parsed = categoriesStepSchema.safeParse(count)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }
    setError(null)
    onNext()
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Tạo các danh mục để phân loại sản phẩm của shop (vd. Áo thun, Quần jeans). Có thể thêm, đổi
        tên, sắp xếp hoặc xóa bất cứ lúc nào sau khi shop được duyệt.
      </Text>
      <CategoryManager showProductCounts={false} />
      {error && count === 0 && (
        <Alert color="red" icon={<IconAlertCircle size={18} aria-hidden />} role="alert">
          {error}
        </Alert>
      )}
      <StepFooter
        onBack={onBack}
        onNext={handleNext}
        loading={saving}
        nextDisabled={categories.isPending}
      />
    </Stack>
  )
}
