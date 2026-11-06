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

Thanh toán thật, đa kho, phân quyền nhiều vai trò, realtime, tích hợp sàn TMĐT, i18n.
