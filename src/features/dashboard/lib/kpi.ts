/** Tổng doanh thu và số đơn của một chuỗi theo ngày. */
export function summarizeSeries(series: ReadonlyArray<{ revenue: number; order_count: number }>) {
  return series.reduce(
    (acc, point) => ({
      revenue: acc.revenue + point.revenue,
      orderCount: acc.orderCount + point.order_count,
    }),
    { revenue: 0, orderCount: 0 },
  )
}
