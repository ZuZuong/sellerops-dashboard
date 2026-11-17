import { Button } from '@mantine/core'
import { IconCategory, IconHistory } from '@tabler/icons-react'
import { Link } from 'react-router'
import {
  CreateProductButton,
  ProductImportButton,
  ProductsView,
  ProductTrashButton,
} from '@/features/products'
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
              to={ROUTES.productCategories}
              variant="subtle"
              leftSection={<IconCategory size={16} aria-hidden />}
            >
              Danh mục
            </Button>
            <Button
              component={Link}
              to={ROUTES.productImports}
              variant="subtle"
              leftSection={<IconHistory size={16} aria-hidden />}
            >
              Lịch sử import
            </Button>
            <ProductTrashButton />
            <ProductImportButton />
            <CreateProductButton />
          </>
        }
      />
      <ProductsView />
    </>
  )
}
