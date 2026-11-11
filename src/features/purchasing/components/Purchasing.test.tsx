import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import {
  deleteReceipt,
  fetchReceipt,
  fetchReceipts,
  postReceipt,
  saveReceipt,
  searchReceiptProducts,
} from '../api/purchases.api'
import type { PurchaseReceipt, ReceiptDetail, ReceiptProduct } from '../types'
import { PurchasesView } from './PurchasesView'
import { NewReceiptView, ReceiptDetailView } from './ReceiptDetailView'

vi.mock('../api/purchases.api', () => ({
  fetchReceipts: vi.fn(),
  fetchReceipt: vi.fn(),
  searchReceiptProducts: vi.fn(),
  saveReceipt: vi.fn(),
  postReceipt: vi.fn(),
  deleteReceipt: vi.fn(),
}))

const api = {
  fetchReceipts: vi.mocked(fetchReceipts),
  fetchReceipt: vi.mocked(fetchReceipt),
  searchReceiptProducts: vi.mocked(searchReceiptProducts),
  saveReceipt: vi.mocked(saveReceipt),
  postReceipt: vi.mocked(postReceipt),
  deleteReceipt: vi.mocked(deleteReceipt),
}

const RECEIPT_ID = '5b1d2c3e-0000-4000-8000-000000000001'

const SHIRT: ReceiptProduct = {
  id: 'p1',
  name: 'Áo thun basic',
  sku: 'DN-AOTHUNBASIC-001',
  unit: 'Cái',
  stock: 10,
  cost_price: 90_000,
}

const makeDetail = (overrides: Partial<ReceiptDetail> = {}): ReceiptDetail => ({
  id: RECEIPT_ID,
  code: 'PN-000001',
  status: 'posted',
  supplier_name: 'Công ty May A',
  supplier_phone: '0901234567',
  invoice_number: 'HD-0012',
  delivered_by: 'Anh Tuấn',
  received_date: '2026-11-10',
  note: null,
  total_amount: 1_890_000,
  created_at: '2026-11-10T02:00:00Z',
  updated_at: '2026-11-10T02:00:00Z',
  posted_at: '2026-11-10T03:00:00Z',
  items: [
    {
      id: 'i1',
      product_id: 'p1',
      ordered_qty: 20,
      received_qty: 18,
      defective_qty: 1,
      unit_cost: 105_000,
      condition_note: '1 áo lỗi đường may',
      position: 1,
      product: SHIRT,
    },
  ],
  ...overrides,
})

const renderAt = (url: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/purchases" element={<PurchasesView />} />
      <Route path="/purchases/new" element={<NewReceiptView />} />
      <Route
        path="/purchases/:id"
        element={<ReceiptDetailView receiptId={url.split('/').pop() ?? ''} />}
      />
    </Routes>,
    { route: url },
  )

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  api.searchReceiptProducts.mockResolvedValue([SHIRT])
})

describe('Tạo phiếu nhập kho', () => {
  const fillHeaderAndProduct = async () => {
    await userEvent.type(screen.getByRole('textbox', { name: /Nhà cung cấp/ }), 'Công ty May A')
    await userEvent.click(screen.getByRole('combobox', { name: /Sản phẩm 1/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Áo thun basic/ }))
  }
  const qty = (name: string) => screen.getByRole('textbox', { name: `${name} (dòng 1)` })

  it('chọn sản phẩm: điền sẵn giá vốn; thực nhận tự theo SL chứng từ − lỗi; xem trước giá vốn mới', async () => {
    renderAt('/purchases/new')
    await fillHeaderAndProduct()

    expect(qty('Đơn giá nhập')).toHaveValue('90.000 ₫')

    await userEvent.clear(qty('SL theo chứng từ'))
    await userEvent.type(qty('SL theo chứng từ'), '20')
    await userEvent.clear(qty('SL lỗi'))
    await userEvent.type(qty('SL lỗi'), '2')
    expect(qty('SL thực nhận')).toHaveValue('18')

    await userEvent.clear(qty('Đơn giá nhập'))
    await userEvent.type(qty('Đơn giá nhập'), '105000')

    // Thành tiền chỉ tính hàng đạt: 18 × 105.000
    expect(screen.getByTestId('receipt-total')).toHaveTextContent(/1\.890\.000\s₫/)
    expect(screen.getByText('Một triệu tám trăm chín mươi nghìn đồng')).toBeInTheDocument()
    // Giá vốn BQ: (10 × 90.000 + 18 × 105.000) / 28 = 99.642,86
    expect(screen.getByTestId('receipt-item-0-preview')).toHaveTextContent(
      /Tồn 10 → 28 · Giá vốn 90\.000\s₫ → 99\.643\s₫/,
    )
  })

  it('"Lưu nháp" chỉ lưu phiếu (không nhập kho), gửi payload chuẩn', async () => {
    api.saveReceipt.mockResolvedValue(RECEIPT_ID)
    api.fetchReceipt.mockResolvedValue(makeDetail({ status: 'draft', posted_at: null }))
    renderAt('/purchases/new')
    await fillHeaderAndProduct()
    await userEvent.clear(qty('SL theo chứng từ'))
    await userEvent.type(qty('SL theo chứng từ'), '5')

    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    await waitFor(() => expect(api.saveReceipt).toHaveBeenCalledTimes(1))
    expect(api.saveReceipt).toHaveBeenCalledWith(null, {
      header: expect.objectContaining({ supplier_name: 'Công ty May A', supplier_phone: null }),
      items: [
        {
          product_id: 'p1',
          ordered_qty: 5,
          received_qty: 5,
          defective_qty: 0,
          unit_cost: 90_000,
          condition_note: null,
        },
      ],
    })
    expect(api.postReceipt).not.toHaveBeenCalled()
  })

  it('"Lưu & nhập kho" cần xác nhận, nêu rõ hàng lỗi không nhập kho, rồi gọi lưu + duyệt', async () => {
    api.saveReceipt.mockResolvedValue(RECEIPT_ID)
    api.postReceipt.mockResolvedValue()
    api.fetchReceipt.mockResolvedValue(makeDetail())
    renderAt('/purchases/new')
    await fillHeaderAndProduct()
    await userEvent.clear(qty('SL theo chứng từ'))
    await userEvent.type(qty('SL theo chứng từ'), '20')
    await userEvent.clear(qty('SL lỗi'))
    await userEvent.type(qty('SL lỗi'), '1')

    await userEvent.click(screen.getByRole('button', { name: 'Lưu & nhập kho' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nhập kho phiếu này?' })
    expect(dialog).toHaveTextContent('Áo thun basic: +19 Cái')
    expect(dialog).toHaveTextContent('1 sản phẩm lỗi không nhập kho')
    expect(api.saveReceipt).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Nhập kho' }))
    await waitFor(() => expect(api.postReceipt).toHaveBeenCalledWith(RECEIPT_ID))
    expect(api.saveReceipt).toHaveBeenCalledTimes(1)
  })

  it('validate: thiếu nhà cung cấp; thực nhận + lỗi vượt SL chứng từ', async () => {
    renderAt('/purchases/new')
    await userEvent.click(screen.getByRole('combobox', { name: /Sản phẩm 1/ }))
    await userEvent.click(await screen.findByRole('option', { name: /Áo thun basic/ }))
    await userEvent.clear(qty('SL thực nhận'))
    await userEvent.type(qty('SL thực nhận'), '3')

    await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByText('Vui lòng nhập nhà cung cấp')).toBeInTheDocument()
    expect(screen.getByText('Thực nhận + lỗi vượt SL theo chứng từ')).toBeInTheDocument()
    expect(api.saveReceipt).not.toHaveBeenCalled()
  })
})

describe('Chi tiết phiếu nhập', () => {
  it('phiếu đã nhập kho: hiện chứng từ Mẫu 01-VT, tiền bằng chữ, không có nút sửa / xóa', async () => {
    api.fetchReceipt.mockResolvedValue(makeDetail())
    renderAt(`/purchases/${RECEIPT_ID}`)

    expect(await screen.findByRole('heading', { name: 'PHIẾU NHẬP KHO' })).toBeInTheDocument()
    expect(screen.getByText('Mẫu số 01-VT')).toBeInTheDocument()
    expect(screen.getByText('Một triệu tám trăm chín mươi nghìn đồng')).toBeInTheDocument()
    const row = screen.getByText('Áo thun basic').closest('tr')
    expect(row).toHaveTextContent('1 áo lỗi đường may · thiếu 1')
    expect(screen.getByRole('button', { name: 'In phiếu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xóa nháp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu & nhập kho' })).not.toBeInTheDocument()
  })

  it('phiếu nháp: form sửa được; xóa nháp cần xác nhận', async () => {
    api.fetchReceipt.mockResolvedValue(makeDetail({ status: 'draft', posted_at: null }))
    api.deleteReceipt.mockResolvedValue()
    api.fetchReceipts.mockResolvedValue({ items: [], total: 0 })
    renderAt(`/purchases/${RECEIPT_ID}`)

    expect(await screen.findByRole('textbox', { name: /Nhà cung cấp/ })).toHaveValue(
      'Công ty May A',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Xóa nháp' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xóa phiếu nháp?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xóa phiếu' }))
    await waitFor(() => expect(api.deleteReceipt).toHaveBeenCalledWith(RECEIPT_ID))
  })

  it('id sai định dạng hoặc không tồn tại → empty state', async () => {
    api.fetchReceipt.mockResolvedValue(null)
    renderAt(`/purchases/${RECEIPT_ID}`)
    expect(await screen.findByText('Không tìm thấy phiếu nhập')).toBeInTheDocument()
  })
})

describe('Danh sách phiếu nhập', () => {
  const makeRow = (overrides: Partial<PurchaseReceipt> = {}): PurchaseReceipt => ({
    id: RECEIPT_ID,
    code: 'PN-000001',
    status: 'posted',
    supplier_name: 'Công ty May A',
    supplier_phone: null,
    invoice_number: 'HD-0012',
    received_date: '2026-11-10',
    total_amount: 1_890_000,
    created_at: '2026-11-10T02:00:00Z',
    posted_at: '2026-11-10T03:00:00Z',
    received_qty: 18,
    defective_qty: 1,
    ...overrides,
  })

  it('hiện phiếu, số lỗi, trạng thái; lọc trạng thái ghi lên URL', async () => {
    api.fetchReceipts.mockResolvedValue({
      items: [
        makeRow(),
        makeRow({ id: 'r2', code: 'PN-000002', status: 'draft', defective_qty: 0 }),
      ],
      total: 2,
    })
    renderAt('/purchases')

    const link = await screen.findByRole('link', { name: 'PN-000001' })
    expect(link.closest('tr')).toHaveTextContent('1 lỗi')
    expect(link.closest('tr')).toHaveTextContent('Đã nhập kho')
    expect(screen.getByRole('link', { name: 'PN-000002' }).closest('tr')).toHaveTextContent('Nháp')

    await userEvent.click(screen.getByRole('radio', { name: 'Nháp' }))
    await waitFor(() =>
      expect(api.fetchReceipts).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'draft', page: 1 }),
      ),
    )
  })

  it('chưa có phiếu → empty state có nút tạo phiếu', async () => {
    api.fetchReceipts.mockResolvedValue({ items: [], total: 0 })
    renderAt('/purchases')
    expect(await screen.findByText('Chưa có phiếu nhập nào')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tạo phiếu nhập' })).toHaveAttribute(
      'href',
      '/purchases/new',
    )
  })
})
