import { AnalyticsView } from '@/features/analytics'
import { PageHeader } from '@/shared/components/PageHeader'

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Phân tích"
        description="Doanh thu theo thời gian, danh mục và sản phẩm bán chạy; so sánh với kỳ trước."
      />
      <AnalyticsView />
    </>
  )
}
