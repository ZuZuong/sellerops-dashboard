interface LineInput {
  price: number | null | undefined
  quantity: number | null | undefined
}

/** Thành tiền một dòng; dòng chưa chọn sản phẩm / chưa nhập số lượng tính là 0. */
export function lineTotal({ price, quantity }: LineInput): number {
  if (!price || !quantity || quantity < 0) return 0
  return price * quantity
}

/**
 * Tạm tính tổng tiền đơn ở client để hiển thị khi đang nhập.
 * Tổng tiền thật do DB tính (trigger `recalculate_order_total`) theo giá chốt lúc tạo đơn.
 */
export function calcOrderTotal(lines: readonly LineInput[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0)
}
