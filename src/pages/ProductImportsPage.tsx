import { Anchor, Group } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ProductImportButton, ProductImportHistory } from '@/features/products'
import { PageHeader } from '@/shared/components/PageHeader'
import { ROUTES } from '@/shared/constants/routes'

export default function ProductImportsPage() {
  return (
    <>
      <Anchor component={Link} to={ROUTES.products} size="sm" c="dimmed">
        <Group gap={4} mb="xs">
          <IconArrowLeft size={14} aria-hidden />
          Sản phẩm
        </Group>
      </Anchor>
      <PageHeader
        title="Lịch sử import"
        description="Các lần nhập sản phẩm từ Excel: thông tin file gốc, số sản phẩm đã tạo, tải lại file."
        actions={<ProductImportButton />}
      />
      <ProductImportHistory />
    </>
  )
}
