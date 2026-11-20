# SellerOps – Flow Test

Tài liệu kiểm thử theo **luồng nghiệp vụ** (end-to-end) của SellerOps, kèm bản đồ từ mỗi luồng tới file test tự động trong `testcase/`.

- Kiểm thử tay trước mỗi lần merge PR lớn hoặc release: đi lần lượt các luồng ở mục 4.
- Khi thêm test mới: đặt file đúng thư mục theo mục 2 và ghi vào cột **Test tự động** của luồng tương ứng.

---

## 1. Chạy test

| Lệnh                                       | Phạm vi                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `npm test`                                 | Toàn bộ unit + component test (`testcase/**/*.test.{ts,tsx}`, Vitest)                    |
| `npx vitest run testcase/unit`             | Chỉ unit test (logic thuần, schema, api có mock)                                         |
| `npx vitest run testcase/component/orders` | Component test của một khu vực                                                           |
| `npm run test:coverage`                    | Như `npm test` + báo cáo coverage (CI dùng lệnh này)                                     |
| `testcase/db/rls_checks.sql`               | Dán vào Supabase SQL Editor sau mỗi migration; dòng cuối phải là `ALL RLS CHECKS PASSED` |

## 2. Cấu trúc thư mục

```
testcase/
├── FLOW-TEST.md            # tài liệu này
├── support/                # tiện ích dùng chung, alias @test/*
│   ├── setup.ts            # jest-dom, cleanup, stub jsdom (matchMedia, ResizeObserver…)
│   ├── render.tsx          # renderWithProviders, TEST_SELLER_ID
│   └── fixtures/
│       └── products.ts     # dữ liệu mẫu sản phẩm / danh mục
├── unit/<khu-vực>/         # domain, lib, schemas, api (Supabase được mock) – không render UI
├── component/<khu-vực>/    # components, hooks, layouts – render với Testing Library
└── db/
    └── rls_checks.sql      # kiểm tra RLS / RPC trực tiếp trên Postgres
```

`<khu-vực>` trùng tên feature trong `src/features/` (`orders`, `products`…), thêm `shared` và `layouts`.

**Quy ước**

- Tên file: `<đơn vị được test>.test.ts(x)`, giữ nguyên tên module được test.
- Import code bằng alias `@/…`, import tiện ích test bằng `@test/…`. Không dùng đường dẫn tương đối ra ngoài `testcase/`.
- Test được import thẳng vào bên trong feature (`@/features/orders/domain/orderStatus`). Quy tắc lint "chỉ import qua `index.ts`" không áp dụng cho `testcase/`.
- Test component luôn render qua `renderWithProviders` để có Mantine, QueryClient riêng và `SellerScope`.
- Business rule (state machine, tính tiền, tồn kho) bắt buộc có unit test. Quyền truy cập dữ liệu bắt buộc có khối kiểm tra trong `rls_checks.sql`.

## 3. Tài khoản & dữ liệu chuẩn bị

| Ký hiệu    | Vai trò    | Trạng thái                                         |
| ---------- | ---------- | -------------------------------------------------- |
| `ADMIN`    | `admin`    | Hoạt động                                          |
| `SELLER_A` | `seller`   | Shop `approved`, có danh mục + sản phẩm + tồn kho  |
| `SELLER_B` | `seller`   | Shop `approved` khác, dùng kiểm tra cô lập dữ liệu |
| `SELLER_P` | `seller`   | Shop `pending` (đã gửi hồ sơ, chờ duyệt)           |
| `CUSTOMER` | `customer` | Tài khoản người mua                                |

Muốn chạy lại luồng đăng ký / xóa tài khoản với cùng email: xem `supabase/scripts/inspect_account.sql` và `supabase/scripts/purge_account_for_retest.sql`.

## 4. Các luồng test

Ký hiệu cột **Mức**: `P0` chặn release · `P1` quan trọng · `P2` bổ sung.

### 4.1 Xác thực & điều hướng (AUTH)

| ID      | Mức | Luồng                                                             | Kết quả mong đợi                                                                                   |
| ------- | --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| AUTH-01 | P0  | Đăng ký `/register` → xác minh email `/verify-email` → đăng nhập  | Form validate bằng Zod; sau xác minh đăng nhập được, seller mới vào bước hồ sơ shop                |
| AUTH-02 | P0  | Đăng nhập sai mật khẩu / email chưa xác minh                      | Thông báo lỗi tiếng Việt, không lộ email có tồn tại hay không                                      |
| AUTH-03 | P0  | Đăng nhập theo vai trò                                            | `admin` → `/admin`, `seller` → `/seller`, `customer` → `/no-access`. Role đọc từ `profiles`        |
| AUTH-04 | P1  | Truy cập URL được bảo vệ khi chưa đăng nhập                       | Chuyển về `/login?redirect=…`, đăng nhập xong quay lại đúng trang (chỉ chấp nhận đường dẫn nội bộ) |
| AUTH-05 | P1  | Quên mật khẩu `/forgot-password` → link email → `/reset-password` | Đặt mật khẩu mới, hai ô phải khớp; link hỏng / hết hạn báo lỗi rõ ràng                             |
| AUTH-06 | P1  | Seller vào `/admin/*` hoặc admin vào trang ghi của seller         | Bị chặn bởi route guard                                                                            |
| AUTH-07 | P1  | Đăng xuất ở một tab khi có tab nhân bản                           | Tab kia không bị đăng xuất lây (khóa storage xoay vòng)                                            |

**Test tự động:** `unit/auth/*` (`login.schema`, `register.schema`, `authErrors`, `authRedirect`, `redirect`, `account`, `auth.api`), `component/auth/LoginForm`, `component/auth/AuthFlows`, `component/auth/routeGuards`, `unit/shared/authStorage`.

### 4.2 Đăng ký shop & duyệt hồ sơ (ONBOARD)

| ID         | Mức | Luồng                                                                 | Kết quả mong đợi                                                                         |
| ---------- | --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ONBOARD-01 | P0  | Seller mới: Thông tin kinh doanh → Danh mục → Giấy tờ → Cam kết → Gửi | Mỗi bước validate; bước Cam kết phải cuộn tới cuối mới tích được; shop `draft → pending` |
| ONBOARD-02 | P1  | Tải giấy tờ sai định dạng / quá dung lượng                            | Bị từ chối ở client, không upload; tên file được làm sạch khi lưu bucket riêng tư        |
| ONBOARD-03 | P0  | Shop `pending` vào trang dữ liệu                                      | Modal chặn (SellerGate), không đọc / ghi được sản phẩm, đơn hàng (RLS)                   |
| ONBOARD-04 | P0  | Admin duyệt hồ sơ `/admin/approvals`                                  | Shop `approved`, ghi `audit_logs`, seller dùng được ngay                                 |
| ONBOARD-05 | P1  | Admin từ chối có lý do → seller sửa → gửi lại                         | `pending → rejected → pending`; seller thấy lý do                                        |
| ONBOARD-06 | P1  | Admin tạm ngưng / mở lại shop                                         | `approved ⇄ suspended`; khi tạm ngưng seller bị chặn ghi ngay                            |
| ONBOARD-07 | P1  | Chuyển trạng thái sai (vd `draft → approved`)                         | RPC trả lỗi; state machine TS và SQL cho cùng kết quả                                    |

**Test tự động:** `unit/seller-onboarding/*` (`application.schema`, `documentFile`, `sellerGate`), `component/seller-onboarding/SellerGate`, `unit/sellers/sellerStatus` (đối chiếu với migration SQL), `db/rls_checks.sql` khối [2], [8], [9], [11].

### 4.3 Sản phẩm & danh mục (PROD)

| ID      | Mức | Luồng                                                          | Kết quả mong đợi                                                                          |
| ------- | --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PROD-01 | P0  | Tạo / sửa sản phẩm (tên, SKU, giá vốn, giá bán, danh mục, ảnh) | Validate Zod; SKU gợi ý tự sinh; toast thành công / thất bại                              |
| PROD-02 | P0  | Danh sách: tìm kiếm, lọc, sắp xếp, phân trang                  | Tìm kiếm debounce 300ms; filter nằm trên URL (F5 giữ nguyên); phân trang phía server      |
| PROD-03 | P1  | Xóa sản phẩm → Thùng rác `/seller/products/trash` → khôi phục  | Có ConfirmDialog; hiển thị số ngày còn lại (30 ngày); khôi phục trả về danh sách          |
| PROD-04 | P0  | Xóa sản phẩm đã có trong đơn hàng                              | Không xóa cứng, chỉ vô hiệu hóa                                                           |
| PROD-05 | P1  | Nhập Excel/CSV `/seller/products/imports`                      | Tải file mẫu; nhận diện cột, danh mục, đơn vị; báo lỗi theo từng dòng; lưu lịch sử import |
| PROD-06 | P2  | Upload ảnh sai loại / quá lớn                                  | Bị từ chối ở client                                                                       |
| PROD-07 | P1  | Danh mục: thêm, đổi tên, sắp xếp thứ tự                        | Thứ tự lưu đúng; không gắn sản phẩm vào danh mục của shop khác                            |

**Test tự động:** `unit/products/*` (`product.schema`, `productFilters.schema`, `sku`, `importProducts`, `spreadsheet`, `productImages`, `productImages.api`, `productLib`, `productActivity`), `component/products/*` (`ProductsView`, `ProductImportAndMedia`, `ImportHistoryAndInsight`, `ProductTrash`, `useProductFilters`), `component/categories/CategoryManager`, `db/rls_checks.sql` khối [1.4].

### 4.4 Đơn hàng (ORDER) – business rule cốt lõi

| ID       | Mức | Luồng                                                                        | Kết quả mong đợi                                                              |
| -------- | --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ORDER-01 | P0  | Tạo đơn: chọn/lưu khách (`customers`), thêm sản phẩm, phương thức thanh toán | Tổng tiền đúng; `unit_price` chốt giá lúc đặt; đơn ở `pending`                |
| ORDER-02 | P0  | Xác nhận đơn (`confirm_order`)                                               | `pending → confirmed`; tồn kho trừ **trên server**; ghi `inventory_movements` |
| ORDER-03 | P0  | Xác nhận khi thiếu hàng                                                      | Lỗi `INSUFFICIENT_STOCK` → thông báo tiếng Việt; tồn kho không đổi            |
| ORDER-04 | P0  | Xác nhận / hủy đơn không còn `pending` (hai tab cùng thao tác)               | Lỗi `ORDER_NOT_PENDING` → thông báo tiếng Việt                                |
| ORDER-05 | P0  | Hủy đơn (`cancel_order`) từ `pending` / `confirmed`                          | Có ConfirmDialog; đơn đã xác nhận được hoàn kho, ghi `inventory_movements`    |
| ORDER-06 | P0  | `confirmed → shipping → delivered`                                           | Chỉ hiện nút cho bước hợp lệ; không thể hủy đơn đang giao / đã giao           |
| ORDER-07 | P1  | Chi tiết đơn: timeline, lợi nhuận (giá vốn), số tiền bằng chữ                | Timeline đúng thứ tự; lợi nhuận = doanh thu − giá vốn                         |
| ORDER-08 | P1  | Danh sách đơn: lọc theo trạng thái, ngày, tìm kiếm                           | Filter trên URL; phân trang phía server                                       |

**Test tự động:** `unit/orders/*` (`orderStatus`, `order.schema`, `orderLib`, `orderProfit`, `orderTimeline`, `paymentMethod`), `component/orders/*` (`OrdersView`, `OrderDetailView`, `useOrderFilters`), `unit/shared/vndWords`.

### 4.5 Nhập hàng & tồn kho (STOCK)

| ID       | Mức | Luồng                                              | Kết quả mong đợi                                                                   |
| -------- | --- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| STOCK-01 | P0  | Tạo phiếu nhập `/seller/purchases/new` → nhận hàng | Tồn kho tăng; giá vốn cập nhật theo bình quân gia quyền; ghi `inventory_movements` |
| STOCK-02 | P1  | Phiếu nhập: danh sách, chi tiết, trạng thái        | Tổng tiền phiếu đúng; trạng thái hiển thị đúng                                     |
| STOCK-03 | P0  | Điều chỉnh kho thủ công `/seller/inventory`        | Bắt buộc lý do; chênh lệch tính đúng; ghi `inventory_movements`                    |
| STOCK-04 | P1  | Kiểm kê `/seller/inventory/stocktake`, xuất Excel  | Bảng kiểm kê đúng tồn hệ thống; file xlsx mở được                                  |

**Test tự động:** `unit/purchasing/purchasing`, `component/purchasing/Purchasing`, `unit/inventory/*` (`inventoryLib`, `stocktake`), `component/inventory/*` (`InventoryView`, `StocktakeView`).

### 4.6 Dashboard & báo cáo (REPORT)

| ID        | Mức | Luồng                                                                                         | Kết quả mong đợi                                                          |
| --------- | --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| REPORT-01 | P1  | Dashboard `/seller`: KPI, biểu đồ doanh thu, top sản phẩm, đơn gần đây                        | Đổi khoảng ngày → số liệu và % thay đổi đúng; khoảng ngày nằm trên URL    |
| REPORT-02 | P1  | Phân tích `/seller/analytics`: theo danh mục, giá trị đơn trung bình, xuất nhập tồn, xuất CSV | Số liệu khớp dữ liệu đơn; CSV đúng định dạng (escape dấu phẩy, ngoặc kép) |
| REPORT-03 | P1  | Báo cáo doanh thu, xuất Excel                                                                 | Tổng hợp đúng theo kỳ; file xlsx đúng cột                                 |
| REPORT-04 | P0  | Seller chỉ thấy báo cáo shop mình                                                             | Gọi với `p_seller_id` shop khác bị từ chối                                |

**Test tự động:** `unit/dashboard/*` (`kpi`, `dashboardRange.schema`), `component/dashboard/*` (`DashboardWidgets`, `useDashboardRange`), `unit/analytics/*` (`analytics`, `revenueReport`), `component/analytics/*` (`AnalyticsView`, `RevenueReportView`), `unit/shared/*` (`csv`, `xlsxExport`, `metrics`), `db/rls_checks.sql` khối [6].

### 4.7 Admin Console (ADMIN)

| ID       | Mức | Luồng                                                | Kết quả mong đợi                                                                        |
| -------- | --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ADMIN-01 | P0  | Admin xem shop của seller `/admin/sellers/:sellerId` | Dữ liệu đúng shop; **ẩn mọi nút ghi** (readOnly), không impersonation                   |
| ADMIN-02 | P0  | Admin cố ghi dữ liệu kinh doanh (gọi API trực tiếp)  | RLS chặn: admin chỉ đọc                                                                 |
| ADMIN-03 | P0  | Khóa tài khoản `/admin/accounts`                     | Có hiệu lực ngay; seller đang mở app bị đá ra (realtime); admin không tự khóa được mình |
| ADMIN-04 | P1  | Lọc / tìm tài khoản, shop                            | Filter trên URL; nhãn trạng thái tiếng Việt                                             |
| ADMIN-05 | P1  | Nhật ký `/admin/audit-log`                           | Mọi hành động admin có bản ghi; seller không đọc được                                   |
| ADMIN-06 | P0  | Seller / customer gọi RPC admin                      | Bị từ chối                                                                              |

**Test tự động:** `unit/admin/admin`, `component/admin/AdminViews`, `db/rls_checks.sql` khối [5], [7], [10], [12].

### 4.8 Xóa tài khoản (DELETE) – xem ADR 009, 010

| ID        | Mức | Luồng                                                  | Kết quả mong đợi                                                                                                                           |
| --------- | --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| DELETE-01 | P0  | Admin đưa tài khoản vào thùng rác (lý do + bằng chứng) | `account_status = pending_deletion`, khóa ngay, seller bị đá ra; bằng chứng ở bucket riêng tư `violation-evidence`                         |
| DELETE-02 | P0  | Khôi phục từ `/admin/deletions`                        | Tài khoản hoạt động lại, dữ liệu nguyên vẹn                                                                                                |
| DELETE-03 | P0  | Xóa vĩnh viễn                                          | Xóa tài khoản đăng nhập (email đăng ký lại được); **shop + dữ liệu kinh doanh còn nguyên**, `sellers.owner_id = null`, có `former_owner_*` |
| DELETE-04 | P1  | Email thông báo xóa tài khoản                          | Gửi qua Edge Function; khi không gửi được, admin thấy lý do                                                                                |
| DELETE-05 | P1  | Đăng nhập bằng tài khoản trong thùng rác               | Bị chặn, thông báo rõ ràng                                                                                                                 |

**Test tự động:** `component/admin/AdminViews` (DeleteAccountDialog, DeletionsView), `unit/admin/notifyAccountDeletion`, `db/rls_checks.sql` khối [13].

### 4.9 Cô lập dữ liệu đa seller (RLS) – chạy sau mỗi migration

| ID     | Mức | Kiểm tra                                               | Khối trong `db/rls_checks.sql` |
| ------ | --- | ------------------------------------------------------ | ------------------------------ |
| RLS-01 | P0  | Seller A không đọc / sửa được dữ liệu seller B         | [1], [1.4]                     |
| RLS-02 | P0  | Shop chưa duyệt không đọc / ghi dữ liệu kinh doanh     | [2]                            |
| RLS-03 | P0  | Không tự đổi được `role`, `is_locked`, trạng thái shop | [3]                            |
| RLS-04 | P1  | Customer không đọc được `sellers`                      | [4]                            |
| RLS-05 | P0  | Admin chỉ đọc                                          | [5]                            |

### 4.10 Giao diện chung (UI)

| ID    | Mức | Kiểm tra                      | Kết quả mong đợi                                                      |
| ----- | --- | ----------------------------- | --------------------------------------------------------------------- |
| UI-01 | P1  | Mọi màn hình dữ liệu          | Có skeleton khi tải, trạng thái trống, trạng thái lỗi kèm nút thử lại |
| UI-02 | P1  | Responsive 360 / 768 / 1280px | Không cuộn ngang; sidebar thu gọn trên mobile                         |
| UI-03 | P2  | A11y cơ bản                   | Input có label; điều hướng được bằng bàn phím; focus nhìn thấy được   |
| UI-04 | P1  | Chuông thông báo hoạt động    | Hiển thị hoạt động mới, đánh dấu đã đọc                               |
| UI-05 | P2  | Định dạng tiền / ngày         | Luôn qua `shared/lib/formatters` (vd `1.250.000 ₫`, `20/11/2026`)     |

**Test tự động:** `component/shared/*` (`ConfirmDialog`, `WidgetCard`, `useUrlState`), `component/layouts/Sidebar`, `component/activity/*`, `unit/activity/activity`, `unit/shared/*` (`formatters`, `dates`, `errors`, `search`, `activityChanges`).

## 5. Bản đồ file test

| Thư mục                                                                            | Số file       | Luồng chính                 |
| ---------------------------------------------------------------------------------- | ------------- | --------------------------- |
| `unit/auth`, `component/auth`                                                      | 7 + 3         | AUTH                        |
| `unit/seller-onboarding`, `unit/sellers`, `component/seller-onboarding`            | 3 + 1 + 1     | ONBOARD                     |
| `unit/products`, `component/products`, `component/categories`                      | 9 + 5 + 1     | PROD                        |
| `unit/orders`, `component/orders`                                                  | 6 + 3         | ORDER                       |
| `unit/purchasing`, `unit/inventory`, `component/purchasing`, `component/inventory` | 1 + 2 + 1 + 2 | STOCK                       |
| `unit/dashboard`, `unit/analytics`, `component/dashboard`, `component/analytics`   | 2 + 2 + 2 + 2 | REPORT                      |
| `unit/admin`, `component/admin`                                                    | 2 + 1         | ADMIN, DELETE               |
| `unit/activity`, `component/activity`                                              | 1 + 2         | UI                          |
| `unit/shared`, `component/shared`, `component/layouts`                             | 10 + 3 + 1    | UI, dùng chung              |
| `db/rls_checks.sql`                                                                | 1             | RLS, ONBOARD, ADMIN, DELETE |

## 6. Còn thiếu

- **E2E (Playwright)**: CLAUDE.md có `npm run test:e2e` nhưng chưa cài Playwright. Khi thêm, đặt ở `testcase/e2e/` và tự động hóa trước các luồng P0: AUTH-03, ONBOARD-01/04, ORDER-02/03/05, STOCK-01, DELETE-01/03.
- **Realtime đá ra** (ADMIN-03, DELETE-01) và **email** (DELETE-04) hiện chỉ kiểm thử tay.
- **Responsive / a11y** (UI-02, UI-03) hiện chỉ kiểm thử tay.

## 7. Biên bản chạy tay

Sao chép bảng dưới vào mô tả PR khi kiểm thử tay trước release.

| ID  | Kết quả (Pass/Fail) | Ghi chú / link ảnh |
| --- | ------------------- | ------------------ |
|     |                     |                    |
