import { Anchor, Group } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ProductCategoryManager } from '@/features/products'
import { PageHeader } from '@/shared/components/PageHeader'
import { ROUTES } from '@/shared/constants/routes'

export default function ProductCategoriesPage() {
  return (
    <>
      <Anchor component={Link} to={ROUTES.products} size="sm" c="dimmed">
        <Group gap={4} mb="xs">
          <IconArrowLeft size={14} aria-hidden />
          Sản phẩm
        </Group>
      </Anchor>
      <PageHeader
        title="Danh mục sản phẩm"
        description="Thêm, đổi tên hoặc xóa danh mục. Sản phẩm thuộc danh mục bị xóa sẽ chuyển về lưu chưa đăng cho tới khi được chọn lại danh mục."
      />
      <ProductCategoryManager />
    </>
  )
}
