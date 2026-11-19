# SellerOps – E-commerce Management Dashboard

Portfolio project chuẩn doanh nghiệp. Chất lượng code quan trọng hơn số lượng tính năng.

## Stack

React 19, TypeScript (strict), Vite, Mantine UI, TanStack Query, Zustand, React Hook Form + Zod, React Router, Recharts, Supabase (Auth, Postgres, RLS), Vitest + Testing Library, Playwright, GitHub Actions, Vercel.

## Lệnh

- `npm run dev` · `npm run build`
- `npm run lint` (max-warnings 0) · `npm run typecheck` · `npm test` · `npm run test:e2e`

## Kiến trúc (feature-based)

- `src/features/<name>/{api,components,hooks,schemas,types.ts,index.ts}`
- `src/shared/{components,hooks,lib,types,constants}`; `src/pages` chỉ ghép layout + feature
- Feature không import lẫn nhau; chỉ qua `index.ts` hoặc `shared/`
- Component không gọi Supabase trực tiếp: `api/` → `queries.ts` (custom hook)
- Query key dùng factory tập trung (`productKeys.list(filters)`)
- Format tiền/ngày chỉ dùng `shared/lib/formatters`

## Quy tắc state

- Dữ liệu API → TanStack Query
- UI state toàn app (sidebar, theme) → Zustand
- Filter / sort / phân trang → URL search params
- Form → React Hook Form + Zod (`z.infer` cho type)

## Đa seller & phân quyền

- Ba vai trò `admin` / `seller` / `customer`. **Role đọc từ bảng `profiles`**, không bao giờ từ `user_metadata` / `app_metadata`. Client không tự đổi được `role`, `is_locked`.
- **Mọi bảng dữ liệu shop có `seller_id`** (tham chiếu `sellers.id`); bảng con thuộc shop qua bảng cha. Bảng mới phải có `seller_id`, index `(seller_id, …)`, RLS seller + admin-read.
- RLS: seller đọc / ghi khi `seller_id = current_approved_seller_id()` (shop `approved`, tài khoản không khóa); admin **chỉ đọc**. Guard / modal ở UI chỉ phục vụ UX.
- RPC ghi dữ liệu kinh doanh mở đầu bằng `require_approved_seller()`; hành động admin chỉ qua RPC, luôn ghi `audit_logs`.
- Hàm báo cáo nhận `p_seller_id` (bỏ trống = shop của người gọi); query key luôn chứa `sellerId`.
- Xem shop của seller từ admin: `SellerScopeProvider` cung cấp `sellerId` + `readOnly` (không impersonation); khi `readOnly` ẩn mọi nút ghi (component đọc qua `useSellerScope()`). Xem ADR 008.
- Xóa tài khoản: bước 1 đưa vào thùng rác (`profiles.account_status = pending_deletion`, khóa ngay, giữ vô thời hạn, khôi phục được); bước 2 admin "xóa vĩnh viễn" = xóa tài khoản đăng nhập (giải phóng email), **giữ shop + mọi dữ liệu kinh doanh** (`sellers.owner_id = null`, lưu `former_owner_*` dạng chữ). Bằng chứng ở bucket riêng tư `violation-evidence`. Realtime chỉ dùng cho trạng thái tài khoản / shop của chính người dùng (đá ra khi bị khóa / xóa). Email thông báo chỉ qua Edge Function tự dựng nội dung (client không gửi HTML / người nhận). Xem ADR 009, 010.
- Bảng `customers` = **khách do seller lưu** khi tạo đơn (danh bạ của shop), KHÁC role `customer` (tài khoản người mua).
- State machine `seller_status` (`draft → pending → approved ⇄ suspended`, `pending → rejected → pending`): SQL `seller_status_can_transition` + `features/sellers/domain/sellerStatus.ts`, test đối chiếu hai nơi.
- Migration mới: chạy `supabase/tests/rls_checks.sql` trong SQL Editor; Claude Code **không** chạy `db:push`.

## Business rules

- Order: `pending → confirmed → shipping → delivered`; `pending|confirmed → cancelled`
- State machine định nghĩa một nơi (`orders/domain/orderStatus.ts`), có unit test
- Xác nhận/hủy đơn qua Postgres RPC (`confirm_order`, `cancel_order`), **không trừ kho từ client**
- Mã lỗi RPC: `INSUFFICIENT_STOCK`, `ORDER_NOT_PENDING` → map thành thông báo tiếng Việt
- `order_items.unit_price` là giá chốt lúc đặt; sản phẩm đã có trong đơn chỉ vô hiệu hóa, không xóa cứng
- Mọi biến động kho ghi vào `inventory_movements`

## Chuẩn code

- Không dùng `any`; dùng type sinh từ Supabase (`shared/types/database.types.ts`)
- Mọi màn hình dữ liệu có skeleton, empty, error state
- Mọi mutation có toast thành công/thất bại; hành động phá hủy có ConfirmDialog
- Server-side pagination, debounce search 300ms, lazy-load route
- Responsive 360 / 768 / 1280px, a11y cơ bản (label, focus, contrast)

## Bảo mật

- RLS bật trên mọi bảng
- Chỉ dùng `anon key` ở client; không bao giờ đưa `service_role` key vào frontend
- Không commit `.env`; giữ `.env.example` luôn cập nhật

## Git

- Conventional Commits: `feat(orders): add confirm order flow`
- Nhánh `feat/*`, `fix/*`, merge qua PR; CI phải xanh

## Definition of Done

Chạy đúng happy path + edge case · đủ loading/empty/error · validate Zod · không lỗi tsc/ESLint · có test cho business rule · responsive · CI pass.

## Ngoài phạm vi

Thanh toán thật, đa kho, realtime cho dữ liệu kinh doanh (chỉ dùng cho trạng thái tài khoản / shop), tích hợp sàn TMĐT, i18n, impersonation (đăng nhập thay seller), nhiều nhân viên trong một shop, KYC tự động, email khi duyệt / từ chối hồ sơ (chỉ gửi email khi xóa tài khoản), xóa dữ liệu kinh doanh khi xóa tài khoản, admin sửa nội dung cam kết trên giao diện, storefront.
