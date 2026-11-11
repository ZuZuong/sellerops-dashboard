import { describe, expect, it } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from '@/shared/lib/errors'
import { getReceiptErrorMessage } from '../lib/receiptErrors'
import {
  hasReceivedGoods,
  receiptSchema,
  toReceiptPayload,
  type ReceiptFormInput,
} from '../schemas/receipt.schema'
import { lineAmount, receiptTotals, shortageQty, weightedAverageCost } from './costing'
import { isEditable } from './receiptStatus'

describe('weightedAverageCost (bình quân gia quyền)', () => {
  it('tồn 10 × 90.000 + nhập 20 × 105.000 → 100.000', () => {
    expect(weightedAverageCost(10, 90_000, 20, 105_000)).toBe(100_000)
  })

  it('làm tròn 2 chữ số thập phân', () => {
    // (1 × 100 + 2 × 50) / 3 = 66,666…
    expect(weightedAverageCost(1, 100, 2, 50)).toBe(66.67)
  })

  it('kho đang trống → giá vốn = đơn giá nhập', () => {
    expect(weightedAverageCost(0, 0, 5, 120_000)).toBe(120_000)
  })

  it('không nhập gì → giữ giá vốn hiện tại', () => {
    expect(weightedAverageCost(10, 90_000, 0, 200_000)).toBe(90_000)
  })
})

describe('receipt totals', () => {
  const lines = [
    { ordered_qty: 10, received_qty: 8, defective_qty: 1, unit_cost: 50_000 },
    { ordered_qty: 5, received_qty: 5, defective_qty: 0, unit_cost: 20_000 },
  ]

  it('thành tiền chỉ tính hàng đạt (thực nhận); hàng lỗi không tính', () => {
    expect(lineAmount(lines[0] ?? {})).toBe(400_000)
  })

  it('SL thiếu = chứng từ − thực nhận − lỗi', () => {
    expect(shortageQty(lines[0] ?? {})).toBe(1)
    expect(shortageQty({ ordered_qty: 3 })).toBe(3)
  })

  it('tổng hợp phiếu', () => {
    expect(receiptTotals(lines)).toEqual({
      ordered: 15,
      received: 13,
      defective: 1,
      shortage: 1,
      amount: 500_000,
    })
  })
})

describe('receiptSchema', () => {
  const product = { id: 'p1', name: 'Áo', sku: 'DN-AO-001', unit: 'Cái', stock: 3, cost_price: 1 }
  const item: ReceiptFormInput['items'][number] = {
    product,
    ordered_qty: 10,
    received_qty: 9,
    defective_qty: 1,
    unit_cost: 90_000,
    condition_note: ' 1 áo rách đường may ',
  }
  const valid: ReceiptFormInput = {
    supplier_name: ' Công ty May A ',
    supplier_phone: '0283 822 123',
    invoice_number: 'HD-0012',
    delivered_by: '',
    received_date: '2026-11-11',
    note: '',
    items: [item],
  }
  const issues = (input: ReceiptFormInput) => {
    const result = receiptSchema.safeParse(input)
    return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message])
  }

  it('chuẩn hóa và tạo payload chỉ gồm product_id + số liệu', () => {
    expect(toReceiptPayload(receiptSchema.parse(valid))).toEqual({
      header: {
        supplier_name: 'Công ty May A',
        supplier_phone: '0283822123',
        invoice_number: 'HD-0012',
        delivered_by: null,
        received_date: '2026-11-11',
        note: null,
      },
      items: [
        {
          product_id: 'p1',
          ordered_qty: 10,
          received_qty: 9,
          defective_qty: 1,
          unit_cost: 90_000,
          condition_note: '1 áo rách đường may',
        },
      ],
    })
  })

  it('thực nhận + lỗi không vượt SL chứng từ', () => {
    expect(issues({ ...valid, items: [{ ...item, received_qty: 10, defective_qty: 1 }] })).toEqual([
      ['items.0.received_qty', 'Thực nhận + lỗi vượt SL theo chứng từ'],
    ])
  })

  it('bắt buộc nhà cung cấp, ngày hợp lệ, có sản phẩm', () => {
    expect(
      issues({ ...valid, supplier_name: ' ', received_date: '2026-02-30', items: [] }),
    ).toEqual([
      ['supplier_name', 'Vui lòng nhập nhà cung cấp'],
      ['received_date', 'Ngày nhập không hợp lệ'],
      ['items', 'Phiếu nhập cần ít nhất một sản phẩm'],
    ])
  })

  it('không cho trùng sản phẩm trên phiếu', () => {
    expect(issues({ ...valid, items: [item, item] })).toEqual([
      ['items.1.product', 'Sản phẩm đã có trên phiếu — gộp số lượng vào dòng trước'],
    ])
  })

  it('duyệt nhập kho cần ít nhất một dòng có hàng đạt', () => {
    const values = receiptSchema.parse(valid)
    expect(hasReceivedGoods(values)).toBe(true)
    expect(hasReceivedGoods({ items: values.items.map((i) => ({ ...i, received_qty: 0 })) })).toBe(
      false,
    )
  })
})

describe('receipt status & errors', () => {
  it('chỉ phiếu nháp được sửa', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('posted')).toBe(false)
  })

  it('map lỗi RPC', () => {
    expect(getReceiptErrorMessage({ code: 'P0001', message: 'RECEIPT_NOT_DRAFT' })).toMatch(
      /đã nhập kho/,
    )
    expect(getReceiptErrorMessage({ message: 'weird' })).toBe(FALLBACK_ERROR_MESSAGE)
  })
})
