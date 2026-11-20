import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Seller } from '@/features/sellers'
import { renderWithProviders } from '@test/render'
import {
  fetchDocuments,
  saveApplication,
  submitApplication,
} from '@/features/seller-onboarding/api/onboarding.api'
import { OnboardingStepper } from '@/features/seller-onboarding/components/OnboardingStepper'
import { SellerStatusGuard } from '@/features/seller-onboarding/components/SellerStatusGuard'
import { TermsStep } from '@/features/seller-onboarding/components/TermsStep'

vi.mock('@/features/auth/api/auth.api', () => ({
  fetchAccount: vi.fn(async () => ({
    id: 'owner-1',
    email: 'shop@example.com',
    role: 'seller',
    fullName: null,
    status: 'active',
    isLocked: false,
    lockedReason: null,
  })),
  signOut: vi.fn(),
  subscribeToAuthChanges: vi.fn(),
}))

// Phiên đăng nhập của chủ shop (useAccount đọc user hiện tại từ auth store).
vi.mock('@/features/auth/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrentUser: () => ({ id: 'owner-1', email: 'shop@example.com' }),
}))

vi.mock('@/features/categories/api/categories.api', () => ({
  fetchCategories: vi.fn(async () => []),
}))

vi.mock('@/features/seller-onboarding/api/onboarding.api', () => ({
  saveApplication: vi.fn(),
  submitApplication: vi.fn(),
  fetchDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getDocumentUrl: vi.fn(),
}))

const api = {
  saveApplication: vi.mocked(saveApplication),
  submitApplication: vi.mocked(submitApplication),
  fetchDocuments: vi.mocked(fetchDocuments),
}

const seller = (overrides: Partial<Seller> = {}): Seller => ({
  id: 'seller-1',
  owner_id: '3f2b1c4d-1111-4222-8333-444455556666',
  status: 'draft',
  shop_name: 'Thời trang An Nhiên',
  slug: 'thoi-trang-an-nhien',
  business_type: null,
  business_name: null,
  tax_code: null,
  license_number: null,
  address: null,
  representative_name: null,
  representative_phone: null,
  contact_email: null,
  main_category: null,
  current_step: 1,
  terms_version: null,
  terms_accepted_at: null,
  submitted_at: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  suspended_reason: null,
  created_at: '2026-11-19T00:00:00Z',
  updated_at: '2026-11-19T00:00:00Z',
  former_owner_id: null,
  former_owner_email: null,
  former_owner_name: null,
  owner_removed_at: null,
  ...overrides,
})

const renderGuard = (value: Seller) =>
  renderWithProviders(
    <SellerStatusGuard seller={value} lockedView={<button type="button">Nút dashboard</button>}>
      <p>Dashboard thật</p>
    </SellerStatusGuard>,
    { route: '/seller', sellerScope: { sellerId: value.id } },
  )

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
  api.fetchDocuments.mockResolvedValue([])
  api.saveApplication.mockResolvedValue()
})

describe('SellerStatusGuard + SellerGateModal', () => {
  it('approved → dashboard thật, không có modal', () => {
    renderGuard(seller({ status: 'approved' }))
    expect(screen.getByText('Dashboard thật')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('draft → dashboard bị khóa (inert, aria-hidden) + stepper hồ sơ', async () => {
    renderGuard(seller())
    const locked = screen.getByTestId('locked-dashboard')
    expect(locked).toHaveAttribute('aria-hidden', 'true')
    expect(locked).toHaveAttribute('inert')
    expect(screen.queryByText('Dashboard thật')).not.toBeInTheDocument()

    expect(
      await screen.findByRole('dialog', { name: /Hoàn tất hồ sơ kinh doanh/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Thông tin doanh nghiệp' })).toBeInTheDocument()
  })

  it('pending → thông báo chờ duyệt', async () => {
    renderGuard(seller({ status: 'pending', submitted_at: '2026-11-19T03:00:00Z' }))
    expect(
      await screen.findByRole('dialog', { name: /Hồ sơ đang chờ admin xét duyệt/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kiểm tra trạng thái' })).toBeInTheDocument()
  })

  it('rejected → hiện lý do; "Sửa và gửi lại" mở lại stepper với dữ liệu cũ', async () => {
    renderGuard(
      seller({
        status: 'rejected',
        rejection_reason: 'Giấy phép bị mờ',
        business_name: 'Hộ kinh doanh An Nhiên',
        current_step: 1,
      }),
    )
    expect(await screen.findByRole('dialog', { name: /Hồ sơ bị từ chối/ })).toBeInTheDocument()
    expect(screen.getByText('Giấy phép bị mờ')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sửa và gửi lại hồ sơ' }))
    expect(screen.getByLabelText(/Tên doanh nghiệp/)).toHaveValue('Hộ kinh doanh An Nhiên')
  })

  it('suspended → thông báo tạm khóa kèm lý do', async () => {
    renderGuard(seller({ status: 'suspended', suspended_reason: 'Bán hàng giả' }))
    expect(await screen.findByRole('dialog', { name: /Shop đang bị tạm khóa/ })).toBeInTheDocument()
    expect(screen.getByText('Bán hàng giả')).toBeInTheDocument()
  })

  it.each(['draft', 'pending', 'rejected', 'suspended'] as const)(
    '%s: modal không đóng được (không nút đóng, Esc không đóng) và luôn có nút Đăng xuất',
    async (status) => {
      renderGuard(seller({ status, rejection_reason: 'x', suspended_reason: 'y' }))
      const dialog = await screen.findByRole('dialog')
      expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(dialog).toBeInTheDocument()
      // Mantine Modal có nút đóng mặc định không tên; ở đây không có nút nào ngoài nội dung.
      expect(document.querySelector('.mantine-Modal-close')).toBeNull()
    },
  )
})

describe('OnboardingStepper', () => {
  it('khôi phục đúng bước đang làm từ current_step', async () => {
    renderWithProviders(
      <OnboardingStepper
        seller={seller({ current_step: 3 })}
        accountId="owner-1"
        accountEmail="shop@example.com"
      />,
      { route: '/seller' },
    )
    expect(await screen.findByText('Chưa có danh mục nào')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Thông tin doanh nghiệp' })).not.toBeInTheDocument()
  })

  it('bước 2: chưa có giấy phép thì không sang bước 3', async () => {
    renderWithProviders(
      <OnboardingStepper
        seller={seller({ current_step: 2 })}
        accountId="owner-1"
        accountEmail="shop@example.com"
      />,
      { route: '/seller' },
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu và tiếp tục' }))
    expect(await screen.findByText('Vui lòng tải lên giấy phép kinh doanh.')).toBeInTheDocument()
    expect(api.saveApplication).not.toHaveBeenCalled()
  })

  it('bước 1 hợp lệ → lưu nháp kèm bước 2 rồi chuyển bước', async () => {
    renderWithProviders(
      <OnboardingStepper
        seller={seller({
          business_type: 'household',
          business_name: 'Hộ kinh doanh An Nhiên',
          tax_code: '0312345678',
          license_number: '41M8012345',
          address: '12 Nguyễn Huệ, Quận 1',
          representative_name: 'Nguyễn Văn A',
          representative_phone: '0912345678',
          main_category: 'Khác',
        })}
        accountId="owner-1"
        accountEmail="shop@example.com"
      />,
      { route: '/seller' },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }))
    await waitFor(() => expect(api.saveApplication).toHaveBeenCalledTimes(1))
    const [data, step] = api.saveApplication.mock.calls[0] ?? []
    expect(step).toBe(2)
    expect(data).toMatchObject({ contact_email: 'shop@example.com', tax_code: '0312345678' })
    expect(await screen.findByText('Giấy phép kinh doanh')).toBeInTheDocument()
  })
})

describe('TermsStep', () => {
  const viewport = () => screen.getByTestId('terms-viewport')
  const setScroll = (el: HTMLElement, scrollTop: number) => {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 300 })
    Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop })
  }

  it('nút xác nhận chỉ bật khi đã cuộn hết VÀ tick đồng ý', async () => {
    const onSubmit = vi.fn()
    // Giả lập văn bản dài hơn khung trước khi render (effect kiểm tra lúc mount).
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return 1000
      },
    })
    renderWithProviders(<TermsStep submitting={false} onBack={vi.fn()} onSubmit={onSubmit} />)
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original)

    const confirm = screen.getByRole('button', { name: 'Xác nhận tuân thủ và gửi hồ sơ' })
    expect(confirm).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /Tôi đã đọc, hiểu và đồng ý/ }))
    expect(confirm).toBeDisabled()

    setScroll(viewport(), 700)
    fireEvent.scroll(viewport())
    expect(confirm).toBeEnabled()

    await userEvent.click(confirm)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('cuộn hết nhưng chưa tick → vẫn khóa', () => {
    renderWithProviders(<TermsStep submitting={false} onBack={vi.fn()} onSubmit={vi.fn()} />)
    setScroll(viewport(), 700)
    fireEvent.scroll(viewport())
    expect(screen.getByRole('button', { name: 'Xác nhận tuân thủ và gửi hồ sơ' })).toBeDisabled()
  })
})
