import { CreateProductButton, ProductsView } from '@/features/products'
import { PageHeader } from '@/shared/components/PageHeader'

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description="Quản lý danh mục sản phẩm, giá và tồn kho."
        actions={<CreateProductButton />}
      />
      <ProductsView />
    </>
  )
}
