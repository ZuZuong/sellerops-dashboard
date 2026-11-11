import { Drawer, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { ErrorState } from '@/shared/components/ErrorState'
import { getErrorMessage } from '@/shared/lib/errors'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/shared/lib/formatters'
import { calcMargin } from '@/shared/lib/metrics'
import { useProductInsight } from '../api/products.queries'
import type { Product } from '../types'

interface ProductInsightDrawerProps {
  product: Product | null
  onClose: () => void
}

/** "Hiệu quả sản phẩm": giá vốn & lãi, tồn kho, bán ra, nhập hàng — để quyết định giá / nhập thêm. */
export function ProductInsightDrawer({ product, onClose }: ProductInsightDrawerProps) {
  return (
    <Drawer
      opened={product !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title="Hiệu quả sản phẩm"
    >
      {product && <ProductInsight key={product.id} product={product} />}
    </Drawer>
  )
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="xs">
      <Title order={3} size="h6">
        {title}
      </Title>
      <SimpleGrid cols={2} spacing="sm">
        {children}
      </SimpleGrid>
    </Stack>
  )
}

const marginText = (profit: number, revenue: number) => {
  const margin = calcMargin(profit, revenue)
  return margin === null ? undefined : `Biên ${formatPercent(margin)}`
}

function ProductInsight({ product }: { product: Product }) {
  const insight = useProductInsight(product.id)
  const unitProfit = product.price - product.cost_price

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Text fw={600}>{product.name}</Text>
        <Text size="sm" c="dimmed" ff="monospace">
          {product.sku}
        </Text>
      </Stack>

      <Section title="Giá & lãi trên 1 sản phẩm">
        <Metric label="Giá vốn bình quân" value={formatCurrency(product.cost_price)} />
        <Metric label="Giá bán" value={formatCurrency(product.price)} />
        <Metric
          label="Lãi gộp / sản phẩm"
          value={
            <Text span inherit c={unitProfit < 0 ? 'red' : undefined}>
              {formatCurrency(unitProfit)}
            </Text>
          }
          hint={marginText(unitProfit, product.price)}
        />
        <Metric
          label="Tồn kho"
          value={`${formatNumber(product.stock)} ${product.unit}`}
          hint={`Giá trị tồn ${formatCurrency(product.stock * product.cost_price)} (theo giá vốn)`}
        />
      </Section>

      {insight.isPending ? (
        <Stack gap="sm" aria-busy data-testid="insight-skeleton">
          <Skeleton height={80} />
          <Skeleton height={80} />
        </Stack>
      ) : insight.isError ? (
        <ErrorState
          message={getErrorMessage(insight.error)}
          onRetry={() => void insight.refetch()}
          retrying={insight.isRefetching}
        />
      ) : (
        <>
          <Section title="Bán ra (đơn đã xác nhận, toàn thời gian)">
            <Metric
              label="Số lượng đã bán"
              value={`${formatNumber(insight.data.qty_sold)} ${product.unit}`}
            />
            <Metric label="Doanh thu" value={formatCurrency(insight.data.revenue)} />
            <Metric label="Giá vốn hàng bán" value={formatCurrency(insight.data.cogs)} />
            <Metric
              label="Lợi nhuận gộp"
              value={
                <Text span inherit c={insight.data.gross_profit < 0 ? 'red' : undefined}>
                  {formatCurrency(insight.data.gross_profit)}
                </Text>
              }
              hint={marginText(insight.data.gross_profit, insight.data.revenue)}
            />
          </Section>

          <Section title="Nhập hàng (phiếu đã nhập kho)">
            <Metric
              label="Đã nhập (hàng đạt)"
              value={`${formatNumber(insight.data.qty_received)} ${product.unit}`}
              hint={`${formatNumber(insight.data.receipt_count)} phiếu nhập`}
            />
            <Metric
              label="Hàng lỗi / không đạt"
              value={`${formatNumber(insight.data.qty_defective)} ${product.unit}`}
              hint="Không nhập kho"
            />
            <Metric
              label="Lần nhập gần nhất"
              value={
                insight.data.last_receipt_date ? formatDate(insight.data.last_receipt_date) : '—'
              }
              hint={
                insight.data.last_receipt_date
                  ? `Đơn giá nhập ${formatCurrency(insight.data.last_receipt_cost)}`
                  : 'Chưa có phiếu nhập'
              }
            />
          </Section>
        </>
      )}
    </Stack>
  )
}
