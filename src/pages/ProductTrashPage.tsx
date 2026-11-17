import { Anchor, Group } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ProductTrash } from '@/features/products'
import { PageHeader } from '@/shared/components/PageHeader'
import { ROUTES } from '@/shared/constants/routes'

export default function ProductTrashPage() {
  return (
    <>
      <Anchor component={Link} to={ROUTES.products} size="sm" c="dimmed">
        <Group gap={4} mb="xs">
          <IconArrowLeft size={14} aria-hidden />
          Sản phẩm
        </Group>
      </Anchor>
      <PageHeader
        title="Thùng rác"
        description="Sản phẩm đã xóa được giữ 30 ngày. Khôi phục để đưa lại vào danh sách, hoặc xóa vĩnh viễn ngay."
      />
      <ProductTrash />
    </>
  )
}
