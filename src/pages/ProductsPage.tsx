import { Button } from '@mantine/core'
import { IconHistory } from '@tabler/icons-react'
import { Link } from 'react-router'
import { CreateProductButton, ProductImportButton, ProductsView } from '@/features/products'
import { PageHeader } from '@/shared/components/PageHeader'
import { ROUTES } from '@/shared/constants/routes'

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description="Quản lý danh mục sản phẩm, giá và tồn kho."
        actions={
          <>
            <Button
              component={Link}
              to={ROUTES.productImports}
              variant="subtle"
              leftSection={<IconHistory size={16} aria-hidden />}
            >
              Lịch sử import
            </Button>
            <ProductImportButton />
            <CreateProductButton />
          </>
        }
      />
      <ProductsView />
    </>
  )
}
