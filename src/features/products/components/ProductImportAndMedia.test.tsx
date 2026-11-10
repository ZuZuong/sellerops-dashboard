import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { createProduct, createProducts } from '../api/products.api'
import { parseProductImport } from '../lib/importProducts'
import { ProductForm } from './ProductFormModal'
import { ProductImportModal } from './ProductImportModal'

vi.mock('../api/products.api', () => ({
  createProduct: vi.fn(),
  createProducts: vi.fn(),
  updateProduct: vi.fn(),
}))

const createProductMock = vi.mocked(createProduct)
const createProductsMock = vi.mocked(createProducts)

const HEADER = ['Tên sản phẩm', 'Danh mục', 'Giá bán', 'Tồn kho']

beforeEach(() => {
  createProductMock.mockReset()
  createProductsMock.mockReset()
})

describe('ProductImportModal', () => {
  const renderModal = (rows: unknown[][]) => {
    const onClose = vi.fn()
    renderWithProviders(
      <ProductImportModal
        opened
        fileName="san-pham.xlsx"
        result={parseProductImport(rows)}
        onClose={onClose}
        onDownloadTemplate={vi.fn()}
      />,
    )
    return { onClose }
  }

  it('file hợp lệ: hiện danh sách xem trước với SKU dự kiến', async () => {
    renderModal([HEADER, ['Áo thun basic', 'Áo thun', 150000, 10], ['Đầm maxi', 'Đầm', 450000]])

    const dialog = await screen.findByRole('dialog', { name: 'Xem trước sản phẩm nhập từ Excel' })
    expect(within(dialog).getByText(/2 sản phẩm/)).toBeInTheDocument()
    const rows = within(dialog).getAllByRole('row')
    expect(rows).toHaveLength(3) // tiêu đề + 2 sản phẩm
    expect(rows[1]).toHaveTextContent('Áo thun basic')
    expect(rows[1]).toHaveTextContent('DN-AOTHUNBASIC-###')
    expect(rows[2]).toHaveTextContent('Đầm maxi')
  })

  it.each([
    ['Đăng tất cả', true],
    ['Lưu chưa đăng', false],
  ])('"%s" nhập toàn bộ với is_active = %s rồi đóng popup', async (label, publish) => {
    createProductsMock.mockResolvedValue(1)
    const { onClose } = renderModal([HEADER, ['Áo polo', 'Áo polo', 200000]])

    await userEvent.click(await screen.findByRole('button', { name: label }))

    await waitFor(() => expect(createProductsMock).toHaveBeenCalledTimes(1))
    const [products, isActive] = createProductsMock.mock.calls[0] ?? []
    expect(isActive).toBe(publish)
    expect(products).toEqual([
      expect.objectContaining({ name: 'Áo polo', category: 'Áo polo', price: 200000, stock: 0 }),
    ])
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('file thiếu dữ liệu: liệt kê lỗi, không có nút nhập', async () => {
    renderModal([HEADER, ['Áo polo', null, null], ['Ốp lưng', 'Điện thoại', 50000]])

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
    expect(screen.getByText('Thiếu cột "Giá bán".')).toBeInTheDocument()
  })
})

describe('ProductForm – mô tả & ảnh', () => {
  const png = (name: string) => new File(['png'], name, { type: 'image/png' })

  const fillRequired = async () => {
    await userEvent.type(screen.getByRole('textbox', { name: /Tên sản phẩm/ }), 'Áo khoác gió')
    await userEvent.click(screen.getByRole('combobox', { name: /Danh mục/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Áo khoác' }))
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

    const [values, media] = createProductMock.mock.calls[0] ?? []
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
