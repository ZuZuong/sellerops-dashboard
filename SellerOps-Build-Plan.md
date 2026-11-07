# SellerOps – Kế hoạch build chuẩn doanh nghiệp

> E-commerce Management Dashboard · Portfolio project ứng tuyển công ty lớn
> Thời gian: 7 ngày (28–35 giờ) · Nguyên tắc: **ít tính năng, chất lượng production**

---

## 1. Mục tiêu & định vị

| Hạng mục                      | Nội dung                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Sản phẩm                      | Dashboard quản lý bán hàng: Product, Order, Inventory, Analytics                       |
| Người dùng giả định           | Chủ shop / nhân viên vận hành TMĐT                                                     |
| Thông điệp với nhà tuyển dụng | Xây dựng sản phẩm có nghiệp vụ thực tế, codebase sạch, có test, có CI, triển khai được |
| Vị trí nhắm tới               | Frontend Developer / React Developer (Junior–Fresher)                                  |

**Tiêu chí thành công:** nhà tuyển dụng mở repo trong 5 phút và thấy: README rõ, demo chạy, cấu trúc code có tổ chức, CI xanh, test cho nghiệp vụ lõi.

---

## 2. Definition of Done (chuẩn doanh nghiệp)

Một tính năng chỉ được coi là xong khi đạt **toàn bộ**:

- [ ] Chạy đúng happy path và các edge case chính
- [ ] Có loading (skeleton), empty, error state
- [ ] Có validate form bằng Zod, thông báo lỗi rõ ràng
- [ ] Không có `any`, không có lỗi `tsc --noEmit`, không có warning ESLint
- [ ] Có test cho logic nghiệp vụ (nếu là business rule)
- [ ] Responsive: 360px / 768px / 1280px
- [ ] Truy cập bàn phím được, label đầy đủ (a11y cơ bản)
- [ ] Commit theo Conventional Commits, CI pass

---

## 3. Tech stack & lý do chọn (chuẩn bị trả lời phỏng vấn)

| Công nghệ                                            | Vai trò               | Lý do chọn                                                                              |
| ---------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| React 19 + TypeScript (strict)                       | UI + type safety      | Chuẩn thị trường, giảm lỗi runtime                                                      |
| Vite                                                 | Build tool            | Dev server nhanh, cấu hình gọn                                                          |
| Mantine UI (v8)                                      | Component library     | Bộ component đầy đủ (Table, Modal, Notifications, Dates), theming tốt, hỗ trợ dark mode |
| TanStack Query                                       | **Server state**      | Cache, dedupe request, retry, invalidation, optimistic update                           |
| Zustand                                              | **Client/UI state**   | Nhẹ; chỉ cho state không đến từ server (sidebar, theme, bộ lọc tạm)                     |
| React Hook Form + Zod                                | Form + validation     | Hiệu năng tốt, schema dùng chung cho validate và type                                   |
| React Router                                         | Routing               | Route lồng nhau, loader/guard, đồng bộ filter với URL                                   |
| Recharts                                             | Biểu đồ               | Tích hợp React tốt, đủ cho analytics                                                    |
| Supabase                                             | Auth + Postgres + RLS | Backend thật, SQL quan hệ, bảo mật theo hàng                                            |
| Vitest + Testing Library                             | Unit/component test   | Cùng hệ Vite                                                                            |
| Playwright                                           | E2E                   | Kiểm thử luồng quan trọng                                                               |
| ESLint + Prettier + Husky + lint-staged + commitlint | Chất lượng code       | Tự động hóa quy chuẩn                                                                   |
| GitHub Actions                                       | CI                    | Lint, typecheck, test, build mỗi PR                                                     |
| Vercel                                               | Deploy                | Preview deployment theo PR                                                              |

**Quy tắc phân chia state (câu hỏi phỏng vấn kinh điển):**

- Dữ liệu từ API → TanStack Query
- Trạng thái UI cục bộ toàn app → Zustand
- Trạng thái lọc/phân trang/sắp xếp → **URL search params**
- Trạng thái form → React Hook Form

---

## 4. Kiến trúc & cấu trúc thư mục

Áp dụng **feature-based architecture**: mỗi module đóng gói đầy đủ, import một chiều.

```
src/
├─ app/                    # Khởi tạo ứng dụng
│  ├─ providers/           # QueryClient, MantineProvider, Router
│  ├─ router.tsx
│  └─ App.tsx
├─ features/
│  ├─ auth/
│  ├─ dashboard/
│  ├─ products/
│  │  ├─ api/              # products.api.ts, products.queries.ts
│  │  ├─ components/       # ProductTable, ProductForm, ProductFilters
│  │  ├─ hooks/
│  │  ├─ schemas/          # product.schema.ts (Zod)
│  │  ├─ types.ts
│  │  └─ index.ts          # public API của feature
│  ├─ orders/
│  ├─ inventory/
│  └─ analytics/
├─ shared/
│  ├─ components/          # DataTable, PageHeader, EmptyState, ErrorState, ConfirmDialog
│  ├─ hooks/               # useUrlState, useDebounce
│  ├─ lib/                 # supabase client, queryClient, formatters (VND, date)
│  ├─ types/               # database.types.ts (generate từ Supabase)
│  └─ constants/
├─ layouts/                # DashboardLayout (Sidebar, Header)
├─ pages/                  # Route components mỏng, chỉ ghép feature
├─ styles/ theme.ts
└─ test/                   # setup, mocks, factories
```

**Quy tắc kiến trúc:**

1. `features/*` không import lẫn nhau trực tiếp; chỉ qua `index.ts` hoặc `shared/`.
2. Component không gọi Supabase trực tiếp; luôn qua `api/` → `queries.ts` (custom hook).
3. Query keys tập trung bằng factory (`productKeys.list(filters)`), không viết chuỗi rời rạc.
4. Page chỉ ghép layout + feature component, không chứa logic.
5. Format tiền/ngày chỉ dùng hàm trong `shared/lib/formatters`.

Ví dụ query key factory:

```ts
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (f: ProductFilters) => [...productKeys.lists(), f] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
}
```

---

## 5. Data model (Supabase / Postgres)

```sql
create type order_status as enum ('pending','confirmed','shipping','delivered','cancelled');

create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  price numeric(12,0) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, sku)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  customer_name text not null,
  customer_phone text,
  status order_status not null default 'pending',
  total numeric(12,0) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(12,0) not null
);

-- Lịch sử biến động kho (audit trail)
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references products(id),
  delta int not null,
  reason text not null,            -- 'order_confirmed' | 'order_cancelled' | 'manual_adjust'
  order_id uuid references orders(id),
  created_at timestamptz not null default now()
);

create index on products (user_id, name);
create index on orders (user_id, status, created_at desc);
create index on order_items (order_id);
```

**Row Level Security (bắt buộc):**

```sql
alter table products enable row level security;
create policy "own products" on products
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Lặp lại cho orders, order_items (qua orders), inventory_movements
```

**Seed data:** 30–50 sản phẩm, 100–200 đơn trải trong 60–90 ngày để biểu đồ có ý nghĩa. Viết `supabase/seed.sql`.

**Generate type:** `supabase gen types typescript --project-id <id> > src/shared/types/database.types.ts`

---

## 6. Business rules (phần ghi điểm nhất)

### 6.1 Order state machine

```
pending ──► confirmed ──► shipping ──► delivered
   │            │
   └────────────┴──► cancelled
```

| Từ                    | Đến được             | Tác động kho                                 |
| --------------------- | -------------------- | -------------------------------------------- |
| pending               | confirmed, cancelled | confirmed: **trừ kho**; cancelled: không đổi |
| confirmed             | shipping, cancelled  | cancelled: **hoàn kho**                      |
| shipping              | delivered            | —                                            |
| delivered / cancelled | — (trạng thái cuối)  | —                                            |

Định nghĩa transition ở một nơi duy nhất (`orders/domain/orderStatus.ts`), có unit test cho từng chuyển trạng thái hợp lệ và không hợp lệ.

### 6.2 Xác nhận đơn phải atomic (chống bán quá tồn kho)

Không trừ kho từ client. Dùng Postgres function để toàn bộ chạy trong một transaction:

```sql
create or replace function confirm_order(p_order_id uuid) returns void
language plpgsql security invoker as $$
declare r record;
begin
  if not exists (
    select 1 from orders
    where id = p_order_id and status = 'pending' and user_id = auth.uid()
  ) then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  for r in
    select product_id, quantity from order_items
    where order_id = p_order_id order by product_id
  loop
    update products set stock = stock - r.quantity
    where id = r.product_id and stock >= r.quantity;
    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', r.product_id;
    end if;

    insert into inventory_movements (user_id, product_id, delta, reason, order_id)
    values (auth.uid(), r.product_id, -r.quantity, 'order_confirmed', p_order_id);
  end loop;

  update orders set status = 'confirmed' where id = p_order_id;
end $$;
```

Client gọi `supabase.rpc('confirm_order', ...)`, map mã lỗi (`INSUFFICIENT_STOCK`, `ORDER_NOT_PENDING`) thành thông báo tiếng Việt. Làm tương tự cho `cancel_order` (hoàn kho nếu đơn đã confirmed).

### 6.3 Quy tắc khác

- SKU duy nhất theo từng user; giá và tồn kho không âm.
- `unit_price` trong `order_items` là **giá chốt tại thời điểm đặt**, không đọc lại từ `products`.
- Sản phẩm đã có trong đơn không xóa cứng; chuyển `is_active = false`.
- Cảnh báo sắp hết hàng: `stock <= low_stock_threshold`.

---

## 7. Lộ trình 7 ngày (checklist)

> Phân loại: **[MUST]** bắt buộc · **[SHOULD]** nên có · **[STRETCH]** nếu còn thời gian. Nếu trễ tiến độ, cắt STRETCH trước.

### Ngày 1 – Foundation & kiến trúc (4–5h)

- [x] [MUST] Khởi tạo Vite + React 19 + TS strict (`"strict": true`, `noUncheckedIndexedAccess`)
- [x] [MUST] ESLint + Prettier + Husky + lint-staged + commitlint
- [x] [MUST] Path alias `@/`, cấu trúc thư mục mục 4
- [x] [MUST] Provider: Mantine, QueryClient, Router, Notifications
- [x] [MUST] DashboardLayout: Sidebar, Header, theme sáng/tối
- [x] [MUST] Tạo Supabase project, chạy schema + RLS, generate types
- [ ] [MUST] Auth: đăng nhập/đăng xuất, `ProtectedRoute`
- [ ] [MUST] GitHub Actions CI (lint, typecheck, test, build)
- [ ] [SHOULD] Deploy Vercel sớm để có preview URL ngay từ ngày 1

### Ngày 2 – Dashboard (4–5h)

- [ ] [MUST] KPI Cards: doanh thu, số đơn, đơn chờ xử lý, sản phẩm sắp hết
- [ ] [MUST] Revenue Chart (7/30 ngày)
- [ ] [MUST] Recent Orders, Top Selling Products
- [ ] [MUST] Skeleton, empty, error state cho từng widget (độc lập, một widget lỗi không làm hỏng cả trang)
- [ ] [SHOULD] Tính doanh thu bằng SQL view / RPC thay vì kéo toàn bộ đơn về client

### Ngày 3 – Product Management (4–5h)

- [ ] [MUST] Product List với server-side pagination, search (debounce), filter, sort
- [ ] [MUST] CRUD sản phẩm: form RHF + Zod, modal hoặc drawer
- [ ] [MUST] **Filter/sort/page lưu trên URL** (hook `useUrlState`)
- [ ] [MUST] Confirmation dialog khi xóa/vô hiệu hóa
- [ ] [SHOULD] Optimistic update khi sửa nhanh giá/tồn kho
- [ ] [MUST] Unit test cho schema Zod và hook filter

### Ngày 4 – Order Management (4–5h)

- [ ] [MUST] Order Table + filter theo trạng thái (URL-based) + search theo mã/khách
- [ ] [MUST] Tạo đơn: chọn sản phẩm, số lượng, tính tổng, validate
- [ ] [MUST] Order Detail: thông tin, danh sách item, timeline trạng thái
- [ ] [MUST] Cập nhật trạng thái theo state machine; ẩn/disable action không hợp lệ
- [ ] [MUST] Tích hợp RPC `confirm_order` / `cancel_order`, xử lý lỗi thiếu hàng
- [ ] [MUST] Unit test state machine + test component luồng xác nhận (mock RPC)

### Ngày 5 – Inventory & Analytics (4–5h)

- [ ] [MUST] Inventory page: tồn kho, badge cảnh báo sắp hết, điều chỉnh kho thủ công (ghi `inventory_movements`)
- [ ] [MUST] Lịch sử biến động kho theo sản phẩm
- [ ] [MUST] Revenue Analytics + filter theo khoảng thời gian (URL-based)
- [ ] [MUST] Export CSV (xử lý đúng UTF-8 BOM cho tiếng Việt khi mở bằng Excel)
- [ ] [STRETCH] Biểu đồ theo danh mục, so sánh kỳ trước

### Ngày 6 – Polish, kiểm thử, tối ưu (4–5h)

- [ ] [MUST] Responsive toàn bộ trang, bảng cuộn ngang trên mobile
- [ ] [MUST] Error Boundary toàn cục + theo route, trang 404, xử lý mất mạng
- [ ] [MUST] Rà soát toàn bộ loading/empty/error state
- [ ] [MUST] Lazy-load route (`React.lazy`), code-split Recharts
- [ ] [MUST] Playwright E2E: đăng nhập → tạo đơn → xác nhận → kiểm tra tồn kho giảm
- [ ] [MUST] A11y: label, focus, contrast; chạy Lighthouse (mục tiêu ≥ 90 Performance/Accessibility/Best Practices)
- [ ] [SHOULD] Refactor component trùng lặp, rà soát bundle bằng `vite-bundle-visualizer`

### Ngày 7 – Deploy & Portfolio (4–5h)

- [ ] [MUST] Deploy production Vercel, cấu hình env, tài khoản demo (read-only hoặc dữ liệu reset được)
- [ ] [MUST] README chuẩn (mục 10)
- [ ] [MUST] Screenshot, GIF luồng chính, video demo 1–2 phút
- [ ] [MUST] ADR ngắn (mục 10) và sơ đồ kiến trúc / ERD
- [ ] [MUST] Thêm project vào CV và LinkedIn
- [ ] [SHOULD] Luyện trả lời câu hỏi phỏng vấn (mục 12)

---

## 8. Chất lượng code & tự động hóa

**TypeScript:** `strict`, cấm `any` (`@typescript-eslint/no-explicit-any: error`), dùng `z.infer` cho type từ schema, dùng type sinh từ Supabase cho dữ liệu DB.

**Scripts `package.json`:**

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint . --max-warnings 0",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "format": "prettier --write ."
}
```

**CI (`.github/workflows/ci.yml`):** checkout → setup Node → `npm ci` → `lint` → `typecheck` → `test` → `build`. Bật branch protection: PR phải qua CI.

**Git workflow:**

- Nhánh: `main` + `feat/*`, `fix/*`; làm theo PR ngay cả khi làm một mình
- Commit: Conventional Commits (`feat(orders): add confirm order flow`)
- Mỗi ngày tối thiểu 3–5 commit có ý nghĩa; lịch sử commit sạch cũng là điểm đánh giá

**Chiến lược test (tập trung vào giá trị, không chạy theo coverage):**

| Loại      | Phạm vi                                                      |
| --------- | ------------------------------------------------------------ |
| Unit      | State machine đơn hàng, Zod schema, formatter, tính toán KPI |
| Component | ProductForm (validate), luồng xác nhận đơn, ConfirmDialog    |
| E2E       | 1–2 luồng quan trọng nhất                                    |

---

## 9. UX, hiệu năng, bảo mật

**UX bắt buộc**

- Skeleton theo từng vùng, không dùng spinner toàn trang
- Toast thành công/thất bại cho mọi mutation
- Confirm dialog cho hành động phá hủy
- Empty state có hướng dẫn hành động tiếp theo
- Error state có nút "Thử lại"
- Dark/Light theme, ghi nhớ lựa chọn

**Hiệu năng**

- Phân trang phía server, không tải toàn bộ bảng
- `staleTime` hợp lý cho TanStack Query; `placeholderData: keepPreviousData` khi đổi trang
- Debounce search 300ms
- Code-split theo route

**Bảo mật**

- RLS bật trên mọi bảng, kiểm thử bằng hai tài khoản khác nhau
- Chỉ dùng `anon key` ở client; **không bao giờ** đưa `service_role` key vào frontend
- Biến môi trường qua `.env`, có `.env.example`, không commit `.env`
- Validate cả client (Zod) lẫn DB (constraint, CHECK)

---

## 10. Tài liệu repo (cái nhà tuyển dụng đọc đầu tiên)

**README.md – cấu trúc đề xuất**

1. Tên + mô tả một câu + badge CI
2. Live Demo + tài khoản demo
3. Screenshot / GIF
4. Tính năng chính
5. Tech stack
6. Kiến trúc (sơ đồ + giải thích ngắn)
7. Business rules nổi bật (state machine, xác nhận đơn atomic)
8. Hướng dẫn chạy local (≤ 5 lệnh)
9. Cấu trúc thư mục
10. Testing
11. Quyết định kỹ thuật & hướng phát triển

**ADR (Architecture Decision Records) – `docs/adr/`, mỗi file 10–15 dòng**

- `001-tanstack-query-vs-zustand.md`
- `002-feature-based-structure.md`
- `003-atomic-order-confirmation-with-rpc.md`
- `004-url-as-source-of-truth-for-filters.md`
- `005-supabase-rls.md`

Mỗi ADR gồm: Bối cảnh · Quyết định · Lý do · Đánh đổi.

---

## 11. Phạm vi: làm gì và không làm gì

**Làm:** đúng các module trong lộ trình, làm sâu, làm chắc.

**Không làm (ghi vào README mục "Hướng phát triển"):** thanh toán thật, đa kho, phân quyền nhiều vai trò, realtime, tích hợp sàn TMĐT, i18n đa ngôn ngữ.

**Quy tắc cắt scope:** cuối ngày 4 nếu chưa xong Order Management với RPC và test, dừng thêm tính năng ở Ngày 5 và dành thời gian hoàn thiện. Một luồng đơn hàng đúng nghiệp vụ có giá trị hơn năm trang giao diện.

---

## 12. Câu hỏi phỏng vấn cần trả lời được

1. Vì sao dùng TanStack Query cho API data thay vì Zustand? Khi nào dùng Zustand?
2. `staleTime` và `gcTime` khác nhau thế nào? Bạn cấu hình ra sao?
3. Cache invalidation sau mutation: bạn invalidate key nào, vì sao?
4. Optimistic update hoạt động thế nào, rollback khi lỗi ra sao?
5. Vì sao lưu filter trên URL? Hạn chế là gì?
6. Làm sao ngăn bán quá tồn kho khi hai người cùng xác nhận đơn? (transaction, điều kiện `stock >= qty`)
7. Vì sao lưu `unit_price` trong `order_items`?
8. RLS hoạt động thế nào? Làm sao bạn kiểm tra nó?
9. Cấu trúc feature-based giải quyết vấn đề gì so với chia theo loại file?
10. Bạn tối ưu hiệu năng bảng dữ liệu lớn bằng cách nào?
11. Bạn test gì, không test gì, vì sao?
12. Nếu có thêm 1 tháng, bạn cải thiện điều gì? (realtime, phân quyền, observability, pagination cursor)

---

## 13. Mô tả CV

**SellerOps – E-commerce Management Dashboard**
Personal Project | Frontend Developer
Technologies: React 19, TypeScript, Vite, TanStack Query, Zustand, React Hook Form, Zod, Mantine UI, Recharts, Supabase, Vitest, Playwright, GitHub Actions.

- Xây dựng dashboard quản lý bán hàng gồm các module sản phẩm, đơn hàng, tồn kho và phân tích doanh thu theo kiến trúc feature-based, TypeScript strict.
- Triển khai quy trình xác nhận đơn hàng atomic bằng Postgres function, đảm bảo không bán quá tồn kho và ghi lịch sử biến động kho.
- Quản lý server state bằng TanStack Query (cache, invalidation, optimistic update); đồng bộ bộ lọc, sắp xếp, phân trang với URL.
- Thiết lập chất lượng code tự động: ESLint, Prettier, Husky, CI GitHub Actions, unit test với Vitest và E2E với Playwright.
- Bảo mật dữ liệu bằng Supabase Auth và Row Level Security; tối ưu hiệu năng bằng phân trang server-side và code-splitting.

Live Demo: `[URL]` · Source Code: `[GitHub]`

> Chỉ ghi những gì đã hoàn thành và hiểu rõ. Điều chỉnh bullet nếu cắt bớt phạm vi.

---

## 14. Checklist trước khi nộp CV

- [ ] Demo URL truy cập được, có tài khoản demo, tải nhanh
- [ ] CI badge xanh trên README
- [ ] Repo public, không lộ key/secret (kiểm tra lịch sử commit)
- [ ] README có screenshot/GIF và hướng dẫn chạy local
- [ ] Có ít nhất 5 ADR
- [ ] Video demo 1–2 phút đã đính kèm
- [ ] Lighthouse ≥ 90 ở các mục chính
- [ ] Trả lời trôi chảy 12 câu hỏi ở mục 12
