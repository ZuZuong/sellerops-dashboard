import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_CATEGORIES, testCategoryOverview } from '@test/fixtures/products'
import { renderWithProviders, TEST_SELLER_ID } from '@test/render'
import { importProductsFromFile } from '@/features/products/api/productImports.api'
import { createProduct } from '@/features/products/api/products.api'
import { parseProductImport } from '@/features/products/lib/importProducts'
import { ProductForm } from '@/features/products/components/ProductFormModal'
import { ProductImportModal } from '@/features/products/components/ProductImportModal'

vi.mock('@/features/products/api/products.api', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}))

vi.mock('@/features/categories/api/categories.api', () => ({
  fetchCategories: vi.fn(() => Promise.resolve(testCategoryOverview())),
}))

vi.mock('@/features/products/api/productImports.api', () => ({
  importProductsFromFile: vi.fn(),
}))

const createProductMock = vi.mocked(createProduct)
const importMock = vi.mocked(importProductsFromFile)

const HEADER = ['Tên sản phẩm', 'Danh mục', 'Đơn vị tính', 'Giá vốn', 'Giá bán', 'Tồn đầu kỳ']
const FILE = new File(['x'], 'san-pham.xlsx')

beforeEach(() => {
  createProductMock.mockReset()
  importMock.mockReset()
})

describe('ProductImportModal', () => {
  const renderModal = (rows: unknown[][]) => {
    const onClose = vi.fn()
    renderWithProviders(
      <ProductImportModal
        opened
        file={FILE}
        sheetName="Sản phẩm"
        result={parseProductImport(rows, TEST_CATEGORIES)}
        onClose={onClose}
        onDownloadTemplate={vi.fn()}
      />,
    )
    return { onClose }
  }

  it('file hợp lệ: hiện danh sách xem trước, danh mục đầy đủ, cột Số lượng, chỉ 2 nút', async () => {
    renderModal([
      HEADER,
      ['Áo thun basic', 'Áo thun', 'Cái', 90000, 150000, 10],
      ['Đầm maxi', 'Đầm', 'Chiếc', 250000, 450000],
    ])

    const dialog = await screen.findByRole('dialog', { name: 'Xem trước sản phẩm nhập từ Excel' })
    expect(within(dialog).getByText(/2 sản phẩm/)).toBeInTheDocument()
    expect(within(dialog).getByRole('columnheader', { name: 'Số lượng' })).toBeInTheDocument()
    expect(within(dialog).queryByText('SKU dự kiến')).not.toBeInTheDocument()
    const rows = within(dialog).getAllByRole('row')
    expect(rows).toHaveLength(3) // tiêu đề + 2 sản phẩm
    expect(rows[1]).toHaveTextContent('Áo thun basic')
    expect(rows[1]).toHaveTextContent(/90\.000\s₫/)
    expect(
      within(rows[1] as HTMLElement).getByRole('cell', { name: 'Áo thun' }),
    ).toBeInTheDocument()
    expect(rows[2]).toHaveTextContent('Đầm maxi')

    // Mặc định đăng hết; chỉ còn nút Hủy và Đăng tất cả.
    expect(within(dialog).getByRole('columnheader', { name: /^Lưu chưa đăng/ })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('switch', { name: 'Lưu chưa đăng Áo thun basic' }),
    ).not.toBeChecked()
    expect(within(dialog).getByRole('switch', { name: 'Lưu chưa đăng Đầm maxi' })).not.toBeChecked()
    expect(within(dialog).queryByRole('button', { name: 'Lưu chưa đăng' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hủy' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Đăng tất cả' })).toBeInTheDocument()
  })

  it('"Đăng tất cả": lưu file gốc + nhập toàn bộ, mặc định đăng hết rồi đóng popup', async () => {
    importMock.mockResolvedValue({ importId: 'imp-1', count: 1, publishedCount: 1 })
    const { onClose } = renderModal([HEADER, ['Áo polo', 'Áo polo', 'Cái', 120000, 200000]])

    await userEvent.click(await screen.findByRole('button', { name: 'Đăng tất cả' }))

    await waitFor(() => expect(importMock).toHaveBeenCalledTimes(1))
    expect(importMock).toHaveBeenCalledWith(TEST_SELLER_ID, {
      file: FILE,
      sheetName: 'Sản phẩm',
      rowCount: 1,
      products: [
        expect.objectContaining({
          name: 'Áo polo',
          category: 'Áo polo',
          unit: 'Cái',
          cost_price: 120000,
          price: 200000,
          stock: 0,
          publish: true,
        }),
      ],
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('bật công tắc "Lưu chưa đăng" ở sản phẩm: sản phẩm đó được lưu nhưng chưa đăng', async () => {
    importMock.mockResolvedValue({ importId: 'imp-1', count: 2, publishedCount: 1 })
    renderModal([
      HEADER,
      ['Áo polo', 'Áo polo', 'Cái', 120000, 200000],
      ['Đầm maxi', 'Đầm', 'Chiếc', 250000, 450000],
    ])

    await userEvent.click(await screen.findByRole('switch', { name: 'Lưu chưa đăng Đầm maxi' }))
    expect(screen.getByText('Đăng 1 · lưu chưa đăng 1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Đăng tất cả' }))

    await waitFor(() => expect(importMock).toHaveBeenCalledTimes(1))
    expect(importMock.mock.calls[0]?.[1].products).toEqual([
      expect.objectContaining({ name: 'Áo polo', publish: true }),
      expect.objectContaining({ name: 'Đầm maxi', publish: false }),
    ])
  })

  it('giá bán thấp hơn giá vốn: hiện cảnh báo nhưng vẫn cho nhập', async () => {
    renderModal([HEADER, ['Áo xả kho', 'Áo thun', 'Cái', 120000, 99000]])
    const dialog = await screen.findByRole('dialog', { name: 'Xem trước sản phẩm nhập từ Excel' })
    expect(within(dialog).getByText('1 dòng cần xem lại')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Đăng tất cả' })).toBeEnabled()
  })

  it('gạt ở tiêu đề: bật = lưu chưa đăng tất cả, tắt = đăng liền tất cả', async () => {
    importMock.mockResolvedValue({ importId: 'imp-1', count: 2, publishedCount: 0 })
    renderModal([
      HEADER,
      ['Áo polo', 'Áo polo', 'Cái', 120000, 200000],
      ['Đầm maxi', 'Đầm', 'Chiếc', 250000, 450000],
    ])

    const all = await screen.findByRole('switch', { name: 'Lưu chưa đăng tất cả sản phẩm' })
    expect(all).not.toBeChecked()

    await userEvent.click(all)
    expect(screen.getByRole('switch', { name: 'Lưu chưa đăng Áo polo' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Lưu chưa đăng Đầm maxi' })).toBeChecked()
    expect(screen.getByText('Đăng 0 · lưu chưa đăng 2')).toBeInTheDocument()

    // Tắt một dòng → gạt tổng tự tắt theo.
    await userEvent.click(screen.getByRole('switch', { name: 'Lưu chưa đăng Áo polo' }))
    expect(all).not.toBeChecked()

    await userEvent.click(all)
    await userEvent.click(screen.getByRole('button', { name: 'Đăng tất cả' }))
    await waitFor(() => expect(importMock).toHaveBeenCalledTimes(1))
    expect(importMock.mock.calls[0]?.[1].products).toEqual([
      expect.objectContaining({ name: 'Áo polo', publish: false }),
      expect.objectContaining({ name: 'Đầm maxi', publish: false }),
    ])

    await userEvent.click(all)
    expect(screen.getByText('Đăng 2 · lưu chưa đăng 0')).toBeInTheDocument()
  })

  it('có sản phẩm trùng tên: báo lỗi + hỏi có thêm ngay các sản phẩm mới không', async () => {
    importMock.mockResolvedValue({ importId: 'imp-1', count: 1, publishedCount: 1 })
    const parsed = parseProductImport(
      [
        HEADER,
        ['Áo polo', 'Áo polo', 'Cái', 120000, 200000],
        ['Đầm maxi', 'Đầm', 'Chiếc', 250000, 450000],
      ],
      TEST_CATEGORIES,
    )
    if (!parsed.ok) throw new Error('expected ok')
    const [duplicate, fresh] = parsed.products
    renderWithProviders(
      <ProductImportModal
        opened
        file={FILE}
        sheetName="Sản phẩm"
        result={{ ok: true, products: fresh ? [fresh] : [], warnings: [] }}
        duplicates={duplicate ? [duplicate] : []}
        onClose={vi.fn()}
        onDownloadTemplate={vi.fn()}
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'File Excel có sản phẩm trùng tên' })
    expect(within(dialog).getByRole('list', { name: 'Sản phẩm trùng tên' })).toHaveTextContent(
      'Dòng 2: Áo polo',
    )
    expect(dialog).toHaveTextContent('Bạn có muốn thêm ngay các sản phẩm mới này không?')
    expect(within(dialog).getAllByRole('row')).toHaveLength(2) // tiêu đề + 1 sản phẩm mới

    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm 1 sản phẩm mới' }))
    await waitFor(() => expect(importMock).toHaveBeenCalledTimes(1))
    expect(importMock.mock.calls[0]?.[1]).toMatchObject({
      rowCount: 2,
      products: [expect.objectContaining({ name: 'Đầm maxi' })],
    })
  })

  it('tất cả sản phẩm đều trùng tên: không có nút nhập', async () => {
    const parsed = parseProductImport(
      [HEADER, ['Áo polo', 'Áo polo', 'Cái', 120000, 200000]],
      TEST_CATEGORIES,
    )
    if (!parsed.ok) throw new Error('expected ok')
    renderWithProviders(
      <ProductImportModal
        opened
        file={FILE}
        sheetName="Sản phẩm"
        result={{ ok: true, products: [], warnings: [] }}
        duplicates={parsed.products}
        onClose={vi.fn()}
        onDownloadTemplate={vi.fn()}
      />,
    )
    const dialog = await screen.findByRole('dialog', { name: 'File Excel có sản phẩm trùng tên' })
    expect(dialog).toHaveTextContent('không có sản phẩm mới để thêm')
    expect(
      within(dialog).queryByRole('button', { name: /Thêm|Đăng tất cả/ }),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Đóng' })).toBeInTheDocument()
  })

  it('file thiếu dữ liệu: liệt kê lỗi, không có nút nhập', async () => {
    renderModal([
      HEADER,
      ['Áo polo', null, 'Cái', 100000, null],
      ['Ốp lưng', 'Điện thoại', 'Cái', 20000, 50000],
    ])

    const dialog = await screen.findByRole('dialog', { name: 'File Excel chưa đủ dữ liệu' })
    const errors = within(dialog).getByRole('list', { name: 'Danh sách lỗi' })
    expect(errors).toHaveTextContent('Dòng 2: thiếu Danh mục; thiếu Giá bán.')
    expect(errors).toHaveTextContent('Dòng 3: Danh mục "Điện thoại" không có trong danh sách.')
    expect(within(dialog).queryByRole('button', { name: 'Đăng tất cả' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Tải file mẫu' })).toBeInTheDocument()
  })

  it('file thiếu cột bắt buộc', async () => {
    renderModal([['Tên sản phẩm'], ['Áo']])
    expect(await screen.findByText('Thiếu cột "Danh mục".')).toBeInTheDocument()
    expect(screen.getByText('Thiếu cột "Giá vốn".')).toBeInTheDocument()
    expect(screen.getByText('Thiếu cột "Giá bán".')).toBeInTheDocument()
  })
})

describe('ProductForm – mô tả & ảnh', () => {
  const png = (name: string) => new File(['png'], name, { type: 'image/png' })

  const fillRequired = async () => {
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo khoác gió')
    await userEvent.click(screen.getByRole('combobox', { name: /Danh mục/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Áo khoác' }))
    await userEvent.type(screen.getByRole('textbox', { name: /Giá vốn/ }), '250000')
    await userEvent.type(screen.getByRole('textbox', { name: /Giá bán/ }), '390000')
  }

  it('dán ảnh (Ctrl+V) làm ảnh đại diện, chọn thêm ảnh phụ, gửi kèm mô tả', async () => {
    createProductMock.mockResolvedValue({} as Awaited<ReturnType<typeof createProduct>>)
    renderWithProviders(<ProductForm onDone={vi.fn()} />)
    await fillRequired()
    await userEvent.type(screen.getByRole('textbox', { name: /Mô tả sản phẩm/ }), 'Chống nước')

    const form = screen.getByRole('form', { name: 'Thêm sản phẩm' })
    fireEvent.paste(form, { clipboardData: { files: [png('chup-man-hinh.png')] } })
    expect(await screen.findByRole('img', { name: 'Ảnh đại diện sản phẩm' })).toBeInTheDocument()

    const galleryInput = screen
      .getByRole('presentation', { name: 'Thêm ảnh phụ' })
      .querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(galleryInput, [png('mat-sau.png'), png('chi-tiet.png')])
    expect(await screen.findByRole('img', { name: 'Ảnh phụ 2' })).toBeInTheDocument()
    expect(screen.getByText('Ảnh phụ (2/8)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Đăng sản phẩm' }))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(1))

    const [, values, media] = createProductMock.mock.calls[0] ?? []
    expect(values).toMatchObject({ description: 'Chống nước', is_active: true })
    expect(media?.hero?.file?.name).toBe('chup-man-hinh.png')
    expect(media?.gallery.map((image) => image.file?.name)).toEqual(['mat-sau.png', 'chi-tiet.png'])
  })

  it('từ chối file không phải ảnh với thông báo tiếng Việt; xóa được ảnh', async () => {
    renderWithProviders(<ProductForm onDone={vi.fn()} />)
    const form = screen.getByRole('form', { name: 'Thêm sản phẩm' })

    fireEvent.paste(form, {
      clipboardData: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('"a.gif" không phải ảnh JPG, PNG')

    fireEvent.paste(form, { clipboardData: { files: [png('hero.png')] } })
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa ảnh đại diện' }))
    expect(screen.queryByRole('img', { name: 'Ảnh đại diện sản phẩm' })).not.toBeInTheDocument()
  })
})
