# Prompt Ngày 4 (mới): Đa seller, phân quyền, đăng ký doanh nghiệp, Admin

Đọc `CLAUDE.md` và `docs/SellerOps-Build-Plan.md` trước. Task này thay thế Ngày 4 cũ: làm nền đa seller và phân quyền trước, Order Management lùi sang Ngày 5. Cập nhật lại lộ trình trong `docs/SellerOps-Build-Plan.md` cho khớp.

---

## 0. Cách làm việc (bắt buộc)

1. **Lập kế hoạch trước, chưa viết code.** Trình bày kế hoạch theo từng phase, nêu rủi ro và các điểm bạn muốn hỏi lại. Chờ mình xác nhận.
2. Làm **tuần tự từng phase**. Hết mỗi phase thì dừng, báo cáo và chờ mình duyệt rồi mới sang phase sau. Mỗi phase là một nhánh và một PR riêng, tạo từ `main`:
   - Phase 1: `feat/multi-tenant-db`
   - Phase 2: `feat/seller-auth-onboarding`
   - Phase 3: `feat/admin-console`
3. **Không chạy `db:push`.** Viết migration vào `supabase/migrations/`, mình sẽ đọc rồi tự chạy. Sau khi mình chạy xong, hướng dẫn mình `db:types`.
4. Tuân thủ `CLAUDE.md`: TypeScript strict, không `any`, Conventional Commits, `lint`, `typecheck`, `test` phải qua, CI xanh mới báo xong.
5. Sau mỗi quyết định kỹ thuật quan trọng, giải thích ngắn gọn vì sao, vì mình đang học.
6. **Cuối mỗi phase, liệt kê rõ "Việc thủ công mình phải làm"** (cấu hình Supabase, chạy SQL, tạo tài khoản test...). Đừng tự làm các việc đó, đừng đụng vào `.env.local`, không in key hay mật khẩu ra.
7. Mọi chữ hiển thị cho người dùng viết bằng tiếng Việt. Tên file, biến, commit message viết tiếng Anh.

---

## 1. Luồng nghiệp vụ

### 1.1 Seller

1. **Đăng ký** bằng email và mật khẩu. Email phải là email thật và **được xác minh qua thư** (Supabase Confirm email), để dùng được chức năng quên mật khẩu.
2. **Đăng nhập.** Trang đăng nhập có link "Đăng ký" và "Quên mật khẩu".
3. **Quên mật khẩu:** nhập email, nhận thư, mở link vào trang `/reset-password` để đặt mật khẩu mới.
4. Lần đầu vào dashboard (trạng thái `draft`): dashboard hiển thị nhưng **bị khóa hoàn toàn**. Một **modal lớn không đóng được** (không nút đóng, không đóng khi bấm ra ngoài hay nhấn Esc) yêu cầu hoàn tất hồ sơ kinh doanh theo từng bước (stepper):
   - **Bước 1. Thông tin doanh nghiệp:** tên shop, loại hình (hộ kinh doanh / công ty / cá nhân kinh doanh), tên doanh nghiệp, mã số thuế, số giấy phép kinh doanh, địa chỉ, người đại diện, SĐT, email liên hệ, ngành hàng chính.
   - **Bước 2. Giấy tờ:** tải lên giấy phép kinh doanh (bắt buộc) và giấy tờ người đại diện (tùy chọn). Chỉ nhận PDF, JPG, PNG, tối đa 5 MB mỗi file.
   - **Bước 3. Danh mục sản phẩm của shop:** seller **tự tạo danh mục của riêng mình**, tối thiểu 1 danh mục. **Không dùng danh mục mẫu.** Có thể thêm, sửa, đổi thứ tự, xóa trong bước này.
   - **Bước 4. Cam kết và nội quy:** hiển thị văn bản, nút "Xác nhận tuân thủ" chỉ bật sau khi seller đã cuộn hết văn bản **và** tick đồng ý.
5. Seller bấm xác nhận thì hồ sơ gửi đi, trạng thái thành `pending`. Hiện **modal "Hồ sơ đang chờ admin xét duyệt"**, dashboard vẫn khóa.
6. Hồ sơ phải **lưu nháp theo từng bước**: tải lại trang vẫn giữ dữ liệu và quay về đúng bước đang làm.
7. Kết quả duyệt:
   - `approved`: mở khóa dashboard.
   - `rejected`: modal hiển thị lý do từ chối, cho sửa hồ sơ và gửi lại (về `pending`).
   - `suspended`: modal thông báo shop bị tạm khóa, dashboard khóa.

### 1.2 Admin

Admin đăng nhập cùng trang đăng nhập, hệ thống tự chuyển hướng theo role vào `/admin`. Admin quản lý tài khoản, duyệt hồ sơ, xem dashboard của từng seller ở **chế độ chỉ đọc**. Không có luồng đăng ký admin trên giao diện.

---

## 2. Quyết định kiến trúc đã chốt

- **Multi-tenant dùng chung database**, tách dữ liệu bằng `seller_id`, khóa bằng RLS. Một codebase, ba nhóm route theo vai trò.
- **Role lưu trong bảng `profiles`**, tuyệt đối không dùng `user_metadata` hay `app_metadata` do client ghi.
- Người dùng **không tự đổi được `role`, `is_locked`** của chính mình.
- **Quyền do database quyết định.** Modal khóa và guard ở giao diện chỉ phục vụ UX, RLS phải chặn thật.
- Admin **xem với chế độ chỉ đọc**, không impersonation. Admin không ghi trực tiếp dữ liệu kinh doanh của seller, chỉ thực hiện hành động qua RPC có ghi `audit_logs`.
- Giấy tờ lưu ở **Storage bucket riêng tư**, admin xem bằng signed URL hết hạn ngắn.

---

## 3. Phase 1: Database (nhánh `feat/multi-tenant-db`)

Viết migration `supabase/migrations/0002_multi_tenant.sql` (đánh số tiếp theo file mới nhất đang có).

### 3.1 Bảng và kiểu dữ liệu

- `user_role` enum: `admin`, `seller`, `customer`.
- `seller_status` enum: `draft`, `pending`, `approved`, `rejected`, `suspended`.
- `profiles`: `id` (= `auth.users.id`), `role` (mặc định `customer`), `full_name`, `phone`, `is_locked` (mặc định false), `created_at`. Trigger tạo `profiles` khi có user mới trong `auth.users`. **Mặc định `customer`**, role seller chỉ được gán qua RPC `register_as_seller` (xem 3.3).
- `sellers`: `id`, `owner_id` (unique, tham chiếu `auth.users`), `status`, `shop_name`, `slug` (unique), `business_type`, `business_name`, `tax_code`, `license_number`, `address`, `representative_name`, `representative_phone`, `contact_email`, `main_category`, `current_step` (để nhớ bước nháp), `terms_version`, `terms_accepted_at`, `submitted_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at`.
- `seller_documents`: `id`, `seller_id`, `kind` (`business_license`, `representative_id`), `storage_path`, `file_name`, `created_at`.
- `categories`: `id`, `seller_id`, `name`, `slug`, `sort_order`, `is_active`, unique `(seller_id, lower(name))`.
- `audit_logs`: `id`, `actor_id`, `action`, `target_type`, `target_id`, `metadata` (jsonb), `created_at`.

### 3.2 Đổi các bảng hiện có

- `products`, `orders`, `inventory_movements`: đổi `user_id` thành `seller_id` (tham chiếu `sellers.id`). Cập nhật unique constraint, index, RLS, RPC `confirm_order` và `cancel_order` cho khớp.
- `products.category` (chữ) đổi thành `category_id` (khóa ngoại tới `categories`).
- **Dữ liệu cũ đã được xóa sạch** (các bảng `products`, `orders`, `order_items`, `inventory_movements` đang rỗng), nên không cần chuyển đổi dữ liệu sản phẩm hay đơn hàng. Migration vẫn phải chạy an toàn khi bảng rỗng.
- **Backfill `profiles`** cho mọi user đã có trong `auth.users` (role mặc định `customer`). **Không tạo dòng `sellers`** cho bất kỳ tài khoản cũ nào: tài khoản hiện có sẽ được mình gán admin thủ công, seller test sẽ đăng ký qua luồng thật.

### 3.3 Hàm và RPC (security definer, `set search_path = ''`)

- Helper: `is_admin()`, `current_seller_id()`, `is_seller_approved(seller_id)`. Helper phải xét cả `profiles.is_locked`.
- `register_as_seller()`: tạo dòng `sellers` ở `draft` và đặt role `seller` cho người gọi. **Từ chối nếu người gọi là admin hoặc đã có shop.**
- `save_seller_application(...)`: lưu nháp, chỉ khi status là `draft` hoặc `rejected`, chỉ cho chủ shop.
- `submit_seller_application(...)`: kiểm tra đủ thông tin, đủ giấy phép, có ít nhất 1 danh mục, đã xác nhận cam kết (ghi `terms_version`, `terms_accepted_at`); chuyển sang `pending`, ghi `submitted_at`.
- `review_seller(seller_id, decision, reason)`: chỉ admin; chỉ từ `pending` sang `approved` hoặc `rejected` (từ chối bắt buộc có lý do); ghi `audit_logs`.
- `set_seller_suspended(seller_id, suspended, reason)`: chỉ admin; `approved` ⇄ `suspended`; ghi `audit_logs`.
- `set_account_locked(user_id, locked, reason)`: chỉ admin, không được khóa chính mình hay admin khác; ghi `audit_logs`.
- `delete_category(id, move_to_id)`: chặn xóa danh mục đang có sản phẩm trừ khi chuyển sang danh mục khác cùng shop.
- `admin_list_accounts(...)`: trả về tài khoản kèm email (join `auth.users`), phân trang, kiểm tra `is_admin()` bên trong.
- `admin_platform_stats()`: số seller theo trạng thái, tổng doanh số, số đơn, tài khoản mới; kiểm tra `is_admin()`.
- State machine của `seller_status` định nghĩa một nơi, **kiểm tra cả trong SQL** (hàm chuyển trạng thái hợp lệ) **lẫn trong code TypeScript** (có unit test).

### 3.4 RLS

- Bật RLS cho mọi bảng mới.
- `profiles`: người dùng đọc dòng của mình; admin đọc tất cả; **không có policy cho phép user UPDATE `role` hoặc `is_locked`** (dùng column privilege hoặc trigger chặn).
- `sellers`: chủ shop đọc dòng của mình; admin đọc tất cả; **không cho UPDATE trực tiếp từ client**, mọi thay đổi qua RPC.
- `categories`, `products`, `orders`, `order_items`, `inventory_movements`: seller đọc ghi dữ liệu có `seller_id` của mình **và chỉ khi shop `approved`**; admin chỉ **đọc**.
- `seller_documents`: chủ shop đọc và thêm khi `draft` hoặc `rejected`; admin đọc.
- `audit_logs`: chỉ admin đọc; không ai ghi trực tiếp, chỉ RPC ghi.
- Mọi view phải dùng `security_invoker`.

### 3.5 Storage

- Bucket `seller-documents`: **private**, giới hạn 5 MB, chỉ nhận `application/pdf`, `image/jpeg`, `image/png`. Tạo bằng SQL trong migration.
- Đường dẫn file: `{auth.uid()}/{kind}/{timestamp}-{tên-đã-làm-sạch}`.
- Policy trên `storage.objects`: chủ shop upload và đọc trong thư mục của mình khi shop `draft` hoặc `rejected`; admin đọc tất cả; không ai sửa hoặc xóa file của shop `pending` và `approved`.

### 3.6 Kiểm thử và hướng dẫn

- Viết `supabase/tests/rls_checks.sql` chạy được trong SQL Editor (dùng `set local role` và `request.jwt.claims` để giả lập user), kiểm tra: seller A không đọc được dữ liệu seller B, seller `pending` không ghi được sản phẩm, user không tự đổi được `role`, customer không đọc được `sellers`, admin không ghi được `products` trực tiếp.
- Viết `docs/admin-setup.md`: cách tạo tài khoản admin đầu tiên. Dùng placeholder email, **không điền email thật**.
- Cuối phase: dừng, liệt kê việc thủ công, chờ mình chạy migration và `db:types`.

---

## 4. Phase 2: Auth và Onboarding (nhánh `feat/seller-auth-onboarding`)

### 4.1 Auth

- Trang `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` (thông báo "đã gửi thư xác minh").
- Form dùng React Hook Form và Zod. Mật khẩu tối thiểu 8 ký tự, kiểm tra xác nhận mật khẩu.
- Chống lộ thông tin: thông báo quên mật khẩu luôn giống nhau dù email có tồn tại hay không.
- `/reset-password` xử lý phiên khôi phục từ link trong thư rồi gọi `updateUser`. Xử lý link hết hạn hoặc không hợp lệ.
- Sau đăng ký và xác minh email, gọi `register_as_seller()` đúng một lần (idempotent).
- Chuyển hướng sau đăng nhập theo role: `admin` tới `/admin`, `seller` tới `/seller`, `customer` tới trang "không có quyền truy cập dashboard".
- Tài khoản `is_locked` thấy thông báo bị khóa và không vào được app.
- Chuyển dashboard hiện tại về `/seller/*`. Dùng hook `useCurrentSeller()` lấy `seller_id` thay cho `user_id`. Query key luôn chứa `sellerId`. Cập nhật Zod schema, types và test hiện có cho khớp.

### 4.2 Guard

- `RoleGuard` (theo role) và `SellerStatusGuard` (theo `seller_status`). Tách thành hook và component có unit test.
- Khi seller chưa `approved`, render dashboard ở trạng thái khóa (`inert`, `aria-hidden`, không bấm được) cùng `SellerGateModal` theo từng trạng thái: `draft` (stepper), `pending`, `rejected`, `suspended`. Modal chặn bằng Mantine `Modal` với `closeOnClickOutside={false}`, `closeOnEscape={false}`, `withCloseButton={false}`.
- Có nút "Đăng xuất" trong modal để seller không bị kẹt.

### 4.3 Onboarding (stepper 4 bước)

- Mỗi bước có Zod schema riêng, validate trước khi sang bước sau, tự lưu nháp qua `save_seller_application`.
- Bước 2: upload lên Storage kèm thanh tiến trình, kiểm tra loại và dung lượng ở client **và** ở bucket, cho phép xóa và thay file khi `draft` hoặc `rejected`.
- Bước 3: CRUD danh mục (thêm, sửa, đổi thứ tự, xóa), tối thiểu 1 danh mục, chặn trùng tên.
- Bước 4: văn bản cam kết và nội quy lấy từ `features/seller-onboarding/terms.ts` với hằng `TERMS_VERSION`. Soạn **nội dung mẫu bằng tiếng Việt** (trách nhiệm pháp lý, hàng hóa hợp pháp, thông tin chính xác, xử lý đơn hàng và khiếu nại, quy định vi phạm và khóa shop), ghi chú đây là nội dung demo. Nút xác nhận chỉ bật khi cuộn hết và tick đồng ý.
- Sau khi gửi: modal chờ duyệt. Trường hợp `rejected`: hiển thị lý do, đưa seller về form với dữ liệu cũ để sửa và gửi lại.
- Màn hình quản lý danh mục tương ứng ở `/seller/categories` (sau khi `approved`), dùng chung component với bước 3.
- Cập nhật chức năng nhập Excel (nếu đã có) để đối chiếu danh mục với **danh mục của chính seller**.

### 4.4 Kiểm thử

- Unit test: state machine `seller_status`, Zod schema của các bước, hàm kiểm tra file upload.
- Component test: `SellerGateModal` ở bốn trạng thái, modal không đóng được, nút xác nhận cam kết chỉ bật khi đủ điều kiện, stepper khôi phục đúng bước.
- Nếu hợp lý, một E2E Playwright cho luồng đăng ký tới màn hình chờ duyệt (chạy với tài khoản test của mình, không viết sẵn mật khẩu thật vào code).

Cuối phase: dừng, liệt kê việc thủ công (cấu hình Supabase Auth, SMTP, v.v.).

---

## 5. Phase 3: Admin Console (nhánh `feat/admin-console`)

### 5.1 Giao diện

- Layout riêng cho admin, **khác hẳn seller** nhưng dùng chung Mantine và token màu: sidebar tông navy đậm, điểm nhấn một màu duy nhất (ví dụ vàng đồng hoặc indigo), badge "Quản trị nền tảng" trên header, breadcrumb, số liệu dùng `tabular-nums`, bảng dữ liệu mật độ cao, nhịp khoảng cách đồng đều. Hỗ trợ sáng và tối. Cảm giác "cao cấp, chuyên nghiệp" đến từ sự nhất quán và tiết chế, không nhồi hiệu ứng.
- Thanh tìm kiếm nhanh (Mantine Spotlight, phím tắt `Ctrl+K`) để nhảy tới seller hoặc trang quản trị.
- Route lazy-load theo vai trò. Recharts tách chunk riêng.

### 5.2 Các trang

| Route                      | Nội dung                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin`                   | Tổng quan nền tảng: KPI (seller theo trạng thái, hồ sơ chờ duyệt, tổng doanh số, số đơn, tài khoản mới), hàng đợi hồ sơ chờ duyệt, biểu đồ doanh số, hoạt động gần đây từ audit log. Dữ liệu lấy bằng `admin_platform_stats()` |
| `/admin/accounts`          | **Quản lý tài khoản:** bảng (tên, email, role, trạng thái, ngày tạo) bằng `admin_list_accounts`, tìm kiếm, lọc theo role và trạng thái, khóa hoặc mở khóa kèm lý do. Lọc và phân trang lưu trên URL                            |
| `/admin/approvals`         | **Duyệt hồ sơ:** hàng đợi `pending`, mở chi tiết hồ sơ, xem giấy tờ bằng signed URL (hết hạn ngắn), nút Duyệt và Từ chối (bắt buộc lý do, có confirm dialog)                                                                   |
| `/admin/sellers`           | **Quản lý seller:** bảng, lọc theo trạng thái (URL), tìm kiếm, khóa hoặc mở khóa shop                                                                                                                                          |
| `/admin/sellers/:sellerId` | **Chi tiết seller, xem dashboard của họ, chỉ đọc.** Tab: Hồ sơ, Sản phẩm, Danh mục, Đơn hàng, Tồn kho, Phân tích, Nhật ký. Tab nào module chưa xây thì hiển thị "Chưa khả dụng"                                                |
| `/admin/audit-log`         | Nhật ký hành động admin, lọc theo người thực hiện, hành động và thời gian                                                                                                                                                      |
| `/admin/settings`          | Phiên bản cam kết hiện hành, thông tin hệ thống (STRETCH nếu thiếu thời gian)                                                                                                                                                  |

### 5.3 Tái sử dụng component seller ở chế độ chỉ đọc

- Tạo `SellerScopeProvider` cung cấp `sellerId` và `readOnly`. Route seller lấy `sellerId` từ shop của người đăng nhập, route admin lấy từ URL `:sellerId`.
- Các component của dashboard seller đọc `sellerId` và `readOnly` từ context. Khi `readOnly`: ẩn hoặc vô hiệu mọi nút ghi và hiển thị banner **"Đang xem với tư cách Admin, chỉ đọc"**.
- Query key chứa `sellerId` để cache không lẫn giữa các shop.
- Tránh nhân đôi code. Nếu một trang seller chưa tách được, báo mình trước khi sao chép.

### 5.4 Hành động của admin

Chỉ gồm: duyệt, từ chối, khóa hoặc mở khóa shop, khóa hoặc mở khóa tài khoản. Tất cả gọi qua RPC, có confirm dialog, toast kết quả và ghi `audit_logs`. Xử lý lỗi RPC (không đúng trạng thái, không đủ quyền) thành thông báo tiếng Việt.

### 5.5 Kiểm thử

- Unit test cho state machine, hàm map lỗi RPC, `RoleGuard`.
- Component test: `readOnly` thực sự ẩn các nút ghi, bảng sellers lọc theo URL.
- Bổ sung vào `rls_checks.sql`: seller không gọi được RPC của admin, admin không ghi được dữ liệu seller trực tiếp, `admin_list_accounts` từ chối người không phải admin.

---

## 6. Tài liệu (cập nhật xuyên suốt)

- ADR trong `docs/adr/`: `006-multi-tenant-shared-db.md`, `007-role-in-profiles-not-metadata.md`, `008-admin-readonly-view-no-impersonation.md`, `009-private-bucket-signed-urls.md`. Mỗi ADR gồm Bối cảnh, Quyết định, Lý do, Đánh đổi.
- Cập nhật `CLAUDE.md`: quy tắc "mọi bảng dữ liệu shop có `seller_id`", cách xác định role, quy ước `SellerScopeProvider`, cập nhật mục "Ngoài phạm vi".
- Cập nhật `docs/SellerOps-Build-Plan.md` (lộ trình mới, Order Management sang Ngày 5).
- README: thêm mục vai trò và luồng duyệt seller (viết gọn, README đầy đủ để Ngày 7).

---

## 7. Ngoài phạm vi (không làm, ghi vào README "Hướng phát triển")

Đăng nhập thay seller (impersonation), phân quyền nhiều nhân viên trong một shop, thanh toán thật, KYC tự động, thông báo email khi duyệt hồ sơ, admin chỉnh sửa nội dung cam kết trên giao diện, tích hợp storefront (làm riêng sau).

---

## 8. Việc thủ công của mình (Claude Code chỉ nhắc, không tự làm)

| Khi nào                 | Việc                                                                                                                                            | Ghi chú                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Sau Phase 1             | Đọc migration, chạy `npm run db:push` rồi `npm run db:types`                                                                                    | Claude Code không chạy `db:push`                                     |
| Sau Phase 1             | Gán admin cho tài khoản hiện có bằng SQL Editor                                                                                                 | Dùng đúng mẫu SQL trong `docs/admin-setup.md`, email do mình tự điền |
| Sau Phase 1             | Chạy `supabase/tests/rls_checks.sql` trong SQL Editor và báo kết quả                                                                            |                                                                      |
| Trước Phase 2           | Supabase Auth: bật **Confirm email**; đặt **Site URL** và **Redirect URLs** (có `/reset-password`) cho `http://localhost:5173` và domain Vercel |                                                                      |
| Trước Phase 2           | Cân nhắc SMTP riêng (SMTP mặc định giới hạn số thư mỗi giờ, chỉ đủ để test)                                                                     |                                                                      |
| Phase 2                 | Đăng ký tài khoản seller test bằng **email khác** với tài khoản admin, tự nhập mật khẩu                                                         | Không đưa email, mật khẩu thật vào code hay chat                     |
| Phase 3                 | Đăng nhập admin, duyệt hồ sơ seller test                                                                                                        | Kiểm tra luồng từ chối rồi gửi lại                                   |
| Sau khi shop được duyệt | Tạo danh mục khớp với file Excel mẫu rồi nhập 50 sản phẩm                                                                                       | Tên danh mục trong Excel phải khớp danh mục của shop                 |
| Mỗi phase               | Mở PR, chờ CI xanh rồi merge, kiểm tra bản deploy Vercel (biến môi trường mới nếu có)                                                           |                                                                      |

`docs/admin-setup.md` phải ghi rõ mẫu SQL gán admin sau (placeholder, không điền email thật):

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = '<email-admin>'
on conflict (id) do update set role = 'admin';
```

---

## 9. Định nghĩa hoàn thành

- Mỗi phase: CI xanh, test mới đi kèm, PR mô tả rõ, `rls_checks.sql` cập nhật.
- Seller `draft`, `pending`, `rejected`, `suspended` đều **không đọc ghi được dữ liệu kinh doanh** ở tầng database, không chỉ ở giao diện.
- Seller A không thấy và không sửa được bất kỳ dữ liệu nào của seller B.
- Không có secret nào trong code, docs hay lịch sử commit.
- Báo cáo cuối cùng nêu: những gì đã làm, những gì chưa làm, danh sách **việc thủ công** còn lại.
