import { Anchor, Group } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { Link } from 'react-router'
import { CategoryManager } from '@/features/categories'
import { PageHeader } from '@/shared/components/PageHeader'
import { ROUTES } from '@/shared/constants/routes'

export default function CategoriesPage() {
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
        description="Danh mục riêng của shop: thêm, đổi tên, sắp xếp hoặc xóa. Xóa danh mục đang có sản phẩm cần chọn danh mục khác để chuyển sản phẩm sang."
      />
      <CategoryManager />
    </>
  )
}
