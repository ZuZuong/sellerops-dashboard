/**
 * Giá vốn BÌNH QUÂN GIA QUYỀN LIÊN HOÀN — cùng công thức với RPC `post_purchase_receipt`
 * (client chỉ dùng để xem trước, giá trị thật do DB tính trong transaction).
 *
 *   giá vốn mới = (tồn hiện tại × giá vốn hiện tại + SL nhập × đơn giá nhập) / (tồn + SL nhập)
 */
export function weightedAverageCost(
  stock: number,
  currentCost: number,
  receivedQty: number,
  unitCost: number,
): number {
  if (receivedQty <= 0) return currentCost
  const totalQty = Math.max(0, stock) + receivedQty
  const value = Math.max(0, stock) * currentCost + receivedQty * unitCost
  return Math.round((value / totalQty) * 100) / 100
}

export interface ReceiptLine {
  ordered_qty?: number | null
  received_qty?: number | null
  defective_qty?: number | null
  unit_cost?: number | null
}

const n = (value: number | null | undefined) => (typeof value === 'number' && value > 0 ? value : 0)

/** Thành tiền một dòng = SL thực nhận (hàng đạt) × đơn giá nhập. Hàng lỗi không tính tiền nhập kho. */
export function lineAmount(line: ReceiptLine): number {
  return Math.round(n(line.received_qty) * n(line.unit_cost))
}

/** SL thiếu so với chứng từ (NCC giao thiếu) = SL chứng từ − thực nhận − lỗi. */
export function shortageQty(line: ReceiptLine): number {
  return Math.max(0, n(line.ordered_qty) - n(line.received_qty) - n(line.defective_qty))
}

export interface ReceiptTotals {
  ordered: number
  received: number
  defective: number
  shortage: number
  amount: number
}

export function receiptTotals(lines: readonly ReceiptLine[]): ReceiptTotals {
  return lines.reduce<ReceiptTotals>(
    (acc, line) => ({
      ordered: acc.ordered + n(line.ordered_qty),
      received: acc.received + n(line.received_qty),
      defective: acc.defective + n(line.defective_qty),
      shortage: acc.shortage + shortageQty(line),
      amount: acc.amount + lineAmount(line),
    }),
    { ordered: 0, received: 0, defective: 0, shortage: 0, amount: 0 },
  )
}
