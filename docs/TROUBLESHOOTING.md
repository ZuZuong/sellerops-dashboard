# Hướng dẫn xử lý bug thường gặp khi vận hành SellerOps

Tài liệu này dùng khi app chạy sai ở máy dev, trên CI hoặc production (Vercel + Supabase).
Mỗi mục gồm: **triệu chứng → nguyên nhân hay gặp → cách kiểm tra → cách sửa → cách phòng tránh**.

> Nguyên tắc vàng: **tái hiện được trước, sửa sau; sửa xong thì thêm test** để bug không quay lại.

## Mục lục

1. [Quy trình chung khi gặp bug](#1-quy-trình-chung-khi-gặp-bug)
2. [Bộ công cụ chẩn đoán](#2-bộ-công-cụ-chẩn-đoán)
3. [Môi trường & khởi động (dev server, env, HMR)](#3-môi-trường--khởi-động)
4. [Đăng nhập & phiên (Supabase Auth)](#4-đăng-nhập--phiên-supabase-auth)
5. [Database, RLS, RPC & migration](#5-database-rls-rpc--migration)
6. [Upload ảnh (Supabase Storage)](#6-upload-ảnh-supabase-storage)
7. [Dữ liệu không cập nhật / cache (TanStack Query)](#7-dữ-liệu-không-cập-nhật--cache-tanstack-query)
8. [Lỗi React & giao diện](#8-lỗi-react--giao-diện)
9. [Form (React Hook Form + Zod)](#9-form-react-hook-form--zod)
10. [URL state, routing & deploy (Vercel)](#10-url-state-routing--deploy-vercel)
11. [Ngày giờ, múi giờ & định dạng tiền](#11-ngày-giờ-múi-giờ--định-dạng-tiền)
12. [Nhập Excel](#12-nhập-excel)
13. [Typecheck, lint, test & CI](#13-typecheck-lint-test--ci)
14. [Hiệu năng](#14-hiệu-năng)
15. [Sự cố production: xử lý khẩn](#15-sự-cố-production-xử-lý-khẩn)
16. [Bảng tra nhanh mã lỗi](#16-bảng-tra-nhanh-mã-lỗi)
17. [Mẫu báo cáo bug & checklist sau khi sửa](#17-mẫu-báo-cáo-bug--checklist-sau-khi-sửa)

---

## 1. Quy trình chung khi gặp bug

1. **Ghi lại chính xác triệu chứng**: URL đầy đủ (kể cả `?page=2&q=...`), tài khoản, thời điểm, trình duyệt, ảnh chụp, thông báo lỗi nguyên văn.
2. **Tái hiện**: làm lại từng bước. Không tái hiện được → kiểm tra khác biệt môi trường (dữ liệu, tài khoản, cache, múi giờ, phiên bản deploy).
3. **Khoanh vùng tầng lỗi** — đi từ ngoài vào trong:
   - Console có lỗi JS? → tầng React/UI.
   - Tab Network có request đỏ (4xx/5xx)? → tầng API/DB. Đọc **response body**, không chỉ status.
   - Request thành công nhưng dữ liệu sai? → query/filter/RLS/cache.
   - Chỉ lỗi trên production? → env, build, routing, phiên bản cũ trong cache.
4. **Thu hẹp**: tắt bớt filter, thử tài khoản khác, thử dữ liệu tối thiểu. Lỗi xuất hiện từ khi nào? Dùng `git log` / `git bisect` để tìm commit gây lỗi:
   ```bash
   git bisect start
   git bisect bad            # commit hiện tại lỗi
   git bisect good <hash>    # commit cũ chắc chắn chạy đúng
   # chạy thử, rồi gõ git bisect good / git bisect bad cho tới khi tìm ra commit
   git bisect reset
   ```
5. **Viết test tái hiện** (nếu là business rule hoặc logic thuần) → thấy test đỏ → sửa → test xanh.
6. **Sửa đúng gốc**, không vá triệu chứng (vd. đừng `try/catch` nuốt lỗi cho "hết đỏ").
7. Chạy đủ `npm run lint && npm run typecheck && npm test && npm run build`, rồi commit dạng `fix(<scope>): ...`.

---

## 2. Bộ công cụ chẩn đoán

| Công cụ                                                      | Dùng để                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| DevTools → **Console**                                       | Lỗi JS, warning của React (key, update khi render…)                                                     |
| DevTools → **Network** (lọc `supabase.co`)                   | Xem request/response tới PostgREST, Auth, Storage. Response lỗi có `code`, `message`, `details`, `hint` |
| DevTools → **Application** → Local Storage                   | Xem token phiên Supabase (`sb-<ref>-auth-token`)                                                        |
| React DevTools                                               | Props/state, component nào re-render (bật "Highlight updates")                                          |
| Supabase Dashboard → **Logs** (API, Postgres, Auth, Storage) | Lỗi phía server, câu SQL bị từ chối, policy chặn                                                        |
| Supabase → **SQL Editor**                                    | Chạy thử query/RPC, kiểm tra policy, dữ liệu thật                                                       |
| Supabase → **Database → Policies**                           | Xem RLS đang bật/tắt và các policy                                                                      |
| Vercel → Deployments → **Logs / Build Logs**                 | Lỗi build, env thiếu, phiên bản đang chạy                                                               |
| GitHub Actions                                               | Log CI từng bước (format, lint, typecheck, test, build)                                                 |

Mẹo khi đọc lỗi Supabase trong Network: mở request lỗi → tab **Response**. Ví dụ:

```json
{ "code": "42501", "message": "new row violates row-level security policy for table \"products\"" }
```

`code` là chìa khóa để tra ở [bảng mã lỗi](#16-bảng-tra-nhanh-mã-lỗi).

---

## 3. Môi trường & khởi động

### 3.1 Trang trắng, console báo `Biến môi trường không hợp lệ (xem .env.example)`

- **Nguyên nhân**: thiếu `.env` / `.env.local`, sai tên biến, URL sai định dạng, hoặc dùng nhầm secret key (`sb_secret_...`). `src/shared/lib/env.ts` validate bằng Zod và chặn ngay khi khởi động.
- **Sửa**:
  1. Copy `.env.example` → `.env.local`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase → Project Settings → API).
  2. **Khởi động lại** `npm run dev` — Vite chỉ đọc file env lúc khởi động.
  3. Tên biến phải có tiền tố `VITE_`, nếu không sẽ không vào `import.meta.env`.
- **Tuyệt đối không** dùng `service_role` / secret key ở client để "cho chạy được" — key đó bỏ qua RLS, lộ ra là mất toàn bộ dữ liệu.

### 3.2 Production chạy được ở máy nhưng trên Vercel trắng trang / lỗi env

- Env trên Vercel phải khai báo ở **Project → Settings → Environment Variables** cho đúng môi trường (Production / Preview).
- Biến `VITE_*` được **nhúng lúc build** → sửa env xong phải **Redeploy**, không có hiệu lực ngay.

### 3.3 `npm run dev` báo `Port 5173 is in use`

- Một dev server cũ còn chạy. Tắt terminal cũ, hoặc tìm và kill tiến trình:
  ```powershell
  netstat -ano | findstr :5173
  taskkill /PID <pid> /F
  ```
- Vite sẽ tự nhảy sang cổng khác (5174…) — kiểm tra đúng URL trong terminal.

### 3.4 Lưu code mà trình duyệt không cập nhật (HMR hỏng) hoặc bị reload toàn trang

- **Fast Refresh chỉ áp dụng khi file chỉ export component**. File vừa export component vừa export hằng/hàm sẽ bị reload toàn trang (ESLint rule `react-refresh/only-export-components` cảnh báo). → Tách hằng/hàm ra file riêng.
- Sửa `vite.config.ts`, `.env*`, `package.json` → phải restart dev server.
- Project nằm trong thư mục đồng bộ (OneDrive), ổ mạng hoặc WSL đọc ổ Windows → watcher không nhận thay đổi. Chuyển project ra ổ thường, hoặc bật polling tạm thời:
  ```ts
  server: {
    watch: {
      usePolling: true
    }
  }
  ```
- Console báo `[vite] connection lost` → dev server đã chết, xem terminal.

### 3.5 `npm install` / `npm ci` lỗi

- `npm ci` báo lockfile không khớp → ai đó sửa `package.json` mà không commit `package-lock.json`. Chạy `npm install` rồi commit lockfile.
- Sai phiên bản Node → dùng đúng bản trong `.nvmrc` (`nvm use`).
- Gói `xlsx` cài từ `cdn.sheetjs.com` → mạng chặn CDN sẽ lỗi; thử lại mạng khác hoặc cấu hình proxy npm.
- Lỗi lạ sau khi đổi nhánh: xóa `node_modules` và cài lại sạch:
  ```bash
  rm -rf node_modules && npm ci
  ```

---

## 4. Đăng nhập & phiên (Supabase Auth)

### 4.1 Đăng nhập báo `Invalid login credentials`

- Sai email/mật khẩu, **hoặc tài khoản chưa xác nhận email**. Kiểm tra Supabase → Authentication → Users (cột _Confirmed at_).
- Cần reset: Authentication → Users → chọn user → _Send password recovery_.

### 4.2 Link xác nhận email / quên mật khẩu mở ra `localhost` hoặc báo lỗi redirect

- Supabase → Authentication → **URL Configuration**:
  - _Site URL_ = domain production (vd. `https://sellerops.vercel.app`).
  - _Redirect URLs_ thêm `http://localhost:5173/**` và domain preview của Vercel (`https://*-<team>.vercel.app/**`).

### 4.3 F5 là bị đá về trang đăng nhập / vòng lặp redirect login ↔ dashboard

- Route guard kiểm tra session **trước khi** Supabase khôi phục xong phiên từ Local Storage → coi như chưa đăng nhập. Guard phải chờ trạng thái "đang tải phiên" rồi mới quyết định redirect (hiển thị loader trong lúc chờ).
- Kiểm tra Local Storage có key `sb-<ref>-auth-token` không. Không có → phiên không được lưu (trình duyệt chặn storage, chế độ ẩn danh nghiêm ngặt).
- Vòng lặp: `ProtectedRoute` đẩy về `/login`, `GuestRoute` lại đẩy về `/` vì đọc hai nguồn trạng thái khác nhau. → Cả hai phải đọc **cùng một** nguồn session.

### 4.4 Đang dùng thì mọi request trả `401` / `JWT expired`

- Access token hết hạn và không refresh được (máy ngủ lâu, đồng hồ máy lệch nhiều, refresh token đã bị thu hồi khi đăng nhập nơi khác/đổi mật khẩu).
- Sửa: kiểm tra giờ hệ thống; đăng xuất – đăng nhập lại. Về code: lắng nghe `onAuthStateChange` để khi `SIGNED_OUT` thì xóa cache Query (`queryClient.clear()`) và về trang login.

### 4.5 Đăng xuất rồi đăng nhập tài khoản khác vẫn thấy dữ liệu tài khoản cũ

- Cache TanStack Query còn giữ dữ liệu user trước. Khi đăng xuất phải gọi `queryClient.clear()`.

---

## 5. Database, RLS, RPC & migration

### 5.1 Bảng có dữ liệu nhưng app trả về danh sách rỗng, **không có lỗi**

- Đây là dấu hiệu kinh điển của **RLS**: SELECT bị policy lọc thì PostgREST trả `[]` chứ không báo lỗi.
- Kiểm tra:
  1. Request có header `Authorization: Bearer <jwt>` (đã đăng nhập) chưa? Không có → chạy với vai `anon`, mà `anon` không được cấp quyền.
  2. Dòng dữ liệu có đúng `user_id = auth.uid()` của người đang đăng nhập không? Dữ liệu seed/thêm tay trong SQL Editor thường quên gán `user_id`.
  3. Mở Database → Policies xem policy SELECT của bảng.
- Thử nhanh trong SQL Editor với vai người dùng:
  ```sql
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "<user-uuid>"}';
  select count(*) from products;
  ```
- **Không sửa bằng cách tắt RLS.** Sửa dữ liệu (gán đúng `user_id`) hoặc sửa policy.

### 5.2 `42501 new row violates row-level security policy`

- INSERT/UPDATE tạo ra dòng không thỏa `WITH CHECK` của policy, thường do `user_id` sai/thiếu. Kiểm tra cột `user_id` có default `auth.uid()` không, và client không gửi `user_id` của người khác.

### 5.3 `42501 permission denied for table/column ...`

- Thiếu `GRANT`. Dự án dùng **column-level grants**: ví dụ cột `sku` đã `revoke insert, update` vì SKU do trigger sinh. Gửi `sku` (hoặc `is_low_stock` – cột generated) từ client sẽ bị từ chối.
- Sửa ở client: chỉ gửi đúng các cột được phép (các hàm trong `products.api.ts` đã chọn cột tường minh — giữ nguyên cách đó). Nếu thật sự cần cho phép cột mới, viết migration `grant insert (col), update (col) on table to authenticated;`.

### 5.4 Gọi RPC báo `PGRST202 Could not find the function ...` hoặc `404`

- Migration chứa function **chưa được đẩy** lên database: chạy `npm run db:push`.
- Tên/kiểu tham số ở client không khớp chữ ký hàm (PostgREST tìm hàm theo **tên tham số**). So sánh với `database.types.ts`.
- Vừa tạo hàm mà PostgREST chưa thấy → làm mới schema cache:
  ```sql
  notify pgrst, 'reload schema';
  ```

### 5.5 Lỗi nghiệp vụ từ RPC (mã do mình `raise`)

| Mã                   | Ý nghĩa                                                  | Hướng xử lý                                                       |
| -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `INSUFFICIENT_STOCK` | Tồn kho không đủ khi xác nhận đơn / trừ kho              | Nhập thêm hàng hoặc giảm số lượng; kiểm tra `inventory_movements` |
| `ORDER_NOT_PENDING`  | Đơn không còn ở trạng thái cho phép thao tác             | Tải lại danh sách — có thể tab khác đã đổi trạng thái             |
| `PRODUCT_IN_ORDERS`  | Sản phẩm đã có trong đơn, không xóa cứng được            | Dùng "Ngừng bán" thay vì xóa (đúng business rule)                 |
| `PRODUCT_NOT_FOUND`  | Sản phẩm đã bị xóa / không thuộc user                    | Tải lại danh sách                                                 |
| `INVALID_DELTA`      | Số lượng điều chỉnh kho không hợp lệ (0 hoặc làm âm kho) | Kiểm tra input                                                    |
| `INVALID_RANGE`      | Khoảng ngày dashboard ngoài 1..366                       | Kiểm tra tham số `range` trên URL                                 |

Thông báo tiếng Việt được map trong `features/products/lib/productErrors.ts` (và tương tự cho orders). Thấy toast "Đã có lỗi không mong muốn" → mã lỗi mới chưa được map: thêm vào bảng map + test.

### 5.6 Lỗi ràng buộc dữ liệu

- `23505 duplicate key` — trùng khóa unique (vd. SKU). SKU tự sinh qua bảng đếm `product_sku_counters` nên không nên trùng; nếu trùng, kiểm tra ai đó đã thêm SKU tay trong SQL Editor hoặc reset bảng đếm.
- `23503 foreign key violation` — xóa dòng đang được tham chiếu (vd. sản phẩm có `inventory_movements`/`order_items`). Dùng RPC `delete_product` (xóa đúng thứ tự, chặn khi có đơn) thay vì `delete` trực tiếp.
- `23514 check violation` — vi phạm CHECK (giá âm, mô tả quá 5000 ký tự, quá 8 ảnh phụ, đường dẫn ảnh không thuộc thư mục của user…). Đồng bộ lại schema Zod ở client với CHECK trong DB để người dùng thấy lỗi trước khi gửi.

### 5.7 Tồn kho bị lệch so với lịch sử nhập/xuất

- Nguyên tắc: **mọi** thay đổi `stock` phải đi qua RPC (`adjust_stock`, `confirm_order`, `cancel_order`) để ghi `inventory_movements`. Không bao giờ `update products set stock = ...` từ client.
- Kiểm tra đối soát:
  ```sql
  select p.id, p.name, p.stock, coalesce(sum(m.delta), 0) as total_movements
  from products p
  left join inventory_movements m on m.product_id = p.id
  group by p.id
  having p.stock <> coalesce(sum(m.delta), 0);
  ```
  Dòng nào lệch → tìm ai/cái gì đã sửa thẳng `stock`, bổ sung movement điều chỉnh có ghi chú.

### 5.8 Migration

- **`db push` báo migration lịch sử không khớp** (_Remote migration versions not found in local_): có migration được tạo/áp trực tiếp trên dashboard. Kéo về bằng `npx supabase db pull` hoặc sửa lịch sử với `npx supabase migration repair --status applied|reverted <version>`. Đừng xóa file migration đã push.
- **Không sửa file migration đã push.** Cần thay đổi → tạo migration mới.
- Sau mỗi `db:push` **luôn** chạy `npm run db:types` và commit `database.types.ts`; không thì TypeScript báo sai/thiếu cột hoặc tệ hơn là không báo gì.
- Function `SECURITY DEFINER` luôn đặt `set search_path = ''` (hoặc `public`) và dùng tên đầy đủ để tránh bị chiếm quyền qua search_path; nhớ `revoke execute ... from public, anon`.

---

## 6. Upload ảnh (Supabase Storage)

| Triệu chứng                                                     | Nguyên nhân                                                                               | Sửa                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `403` / `new row violates row-level security policy` khi upload | Đường dẫn không bắt đầu bằng `<user_id>/` — policy chỉ cho ghi vào thư mục của chính user | Giữ format `${userId}/${uuid}.${ext}` trong `productImages.api.ts`                                             |
| `413 Payload too large`                                         | Ảnh > 5 MB (giới hạn bucket)                                                              | Nén ảnh; client đã validate `MAX_IMAGE_SIZE`                                                                   |
| `415` / `mime type not supported`                               | Không phải JPG/PNG/WEBP (vd. HEIC từ iPhone, GIF)                                         | Đổi định dạng; muốn hỗ trợ thêm phải sửa cả `allowed_mime_types` của bucket và `validateImageFile`             |
| Ảnh lưu được nhưng hiển thị vỡ / `400 Bucket not found`         | Bucket `product-images` chưa tạo (chưa `db:push`) hoặc không `public`                     | Chạy migration; kiểm tra Storage → Buckets                                                                     |
| Dán ảnh (Ctrl+V) không ăn                                       | Clipboard chứa đường dẫn/HTML chứ không phải file ảnh (copy từ một số trang web)          | Chuột phải → _Copy image_, hoặc chụp màn hình rồi dán                                                          |
| Lưu sản phẩm báo `23514` về ảnh                                 | Đường dẫn ảnh không thuộc user (`paths_owned_by`)                                         | Không ghép đường dẫn tay; luôn lấy path từ kết quả upload                                                      |
| Storage đầy file "mồ côi"                                       | Upload xong nhưng insert lỗi, hoặc xóa sản phẩm mà không xóa ảnh                          | Code đã dọn khi lỗi; dọn định kỳ bằng SQL so sánh `storage.objects` với `products.hero_image_path/image_paths` |

---

## 7. Dữ liệu không cập nhật / cache (TanStack Query)

### 7.1 Thêm/sửa/xóa xong nhưng danh sách (hoặc dashboard) vẫn hiện dữ liệu cũ

- Mutation chưa `invalidateQueries` đúng key. Quy ước: mutation sản phẩm phải invalidate **`productKeys.all`** và **`dashboardKeys.all`** (vì KPI/top sản phẩm phụ thuộc sản phẩm).
- Key tự đặt tay (`['products', ...]`) lệch với factory → luôn dùng factory (`productKeys.list(filters)`).
- Kiểm tra bằng React Query Devtools (nếu bật) hoặc log `queryClient.getQueryCache().findAll()`.

### 7.2 Request bị gọi liên tục / vòng lặp refetch

- Query key chứa object/hàm tạo mới mỗi lần render (vd. `new Date()`, `Date.now()` trong key) → mỗi render là key mới. Chuẩn hóa key thành giá trị ổn định (string/number).
- `useEffect` gọi `refetch` với deps thay đổi liên tục.

### 7.3 Sửa nhanh giá/tồn kho: số nhảy lại giá trị cũ

- Optimistic update bị rollback vì request lỗi (xem toast + Network). Đây là hành vi đúng.
- Nếu request thành công mà vẫn nhảy về: thiếu `invalidate` sau `onSettled`, hoặc `cancelQueries` không được gọi trước khi patch cache nên một refetch cũ ghi đè.

### 7.4 Chuyển trang danh sách bị nháy trắng / skeleton mỗi lần

- Thiếu `placeholderData: keepPreviousData` → mỗi trang mới coi như "chưa có dữ liệu".

### 7.5 Đang ở trang 5, xóa hết sản phẩm trang đó → trang trống

- Trang hiện tại vượt tổng số trang. `ProductsView` có clamp trang; nếu viết màn hình mới (orders…) nhớ làm tương tự. PostgREST trả `PGRST103 Requested range not satisfiable` khi offset vượt quá số dòng.

---

## 8. Lỗi React & giao diện

### 8.1 `Too many re-renders` / `Maximum update depth exceeded`

- Gọi `setState` trực tiếp trong thân render, hoặc `onClick={setOpen(true)}` thay vì `onClick={() => setOpen(true)}`.
- `useEffect` set state mà state đó lại nằm trong deps.
- Sửa: tìm component trong stack trace, kiểm tra từng `setState` / `useEffect`.

### 8.2 `Cannot update a component while rendering a different component`

- Gọi `setState` / `navigate` / `toast` trong lúc render hoặc trong updater của `setState`. Chuyển side effect vào event handler hoặc `useEffect`.

### 8.3 Effect chạy 2 lần, request gửi 2 lần ở dev

- Do **React StrictMode** (chỉ ở dev) cố tình mount–unmount–mount để phát hiện effect thiếu cleanup. Không phải bug production. Bug thật là khi effect không có cleanup (subscribe, timer, `URL.createObjectURL` không `revoke`).

### 8.4 Giá trị cũ trong callback (stale closure)

- Handler/timer dùng state của lần render cũ. Dùng functional update `setX((prev) => ...)`, hoặc `useEffectEvent` cho logic trong effect cần giá trị mới nhất (đã áp dụng ở ô tìm kiếm debounce).

### 8.5 Warning `Each child in a list should have a unique "key"`

- Dùng `id` của dữ liệu làm key, **không** dùng index cho danh sách có thể sắp xếp/xóa — dễ gây lẫn state giữa các dòng (vd. ô sửa nhanh hiện nhầm sản phẩm).

### 8.6 Một widget lỗi làm sập cả trang

- Bọc widget trong `WidgetCard`/`ErrorBoundary`. Lỗi trong route → `RouteErrorBoundary` hiển thị "Có lỗi xảy ra". Xem Console để lấy stack trace gốc.

### 8.7 Dropdown/Modal/Popover hiển thị sai vị trí, bị cắt

- Nằm trong container `overflow: hidden` → dùng `withinPortal` (mặc định của Mantine). Modal lồng modal → kiểm tra `zIndex`.

### 8.8 Giao diện vỡ ở mobile (360px)

- Bảng rộng: bọc trong `Table.ScrollContainer`. Nhóm nút: dùng `Group wrap="wrap"` / `Stack` theo breakpoint. Test ở DevTools → Toggle device toolbar với 360 / 768 / 1280.

### 8.9 Biểu đồ (Recharts) không hiển thị

- `ResponsiveContainer` nằm trong phần tử cao `0` → đặt chiều cao cố định cho khung chứa.
- Dữ liệu `value` là chuỗi (Postgres `numeric` có thể về dạng string) → ép `Number()` ở tầng api.

---

## 9. Form (React Hook Form + Zod)

### 9.1 Bấm lưu không có gì xảy ra

- Form không hợp lệ nhưng lỗi nằm ở field **không hiển thị** (field ẩn, field đã bỏ khỏi UI nhưng còn trong schema). Log tạm `formState.errors` để xem.
- Nút nằm ngoài `<form>` hoặc `type="button"` → không submit.

### 9.2 Lỗi kiểu số: `Expected number, received string`

- Input trả string, schema chờ number. Dùng `NumberInput` của Mantine hoặc `z.coerce`, và dùng `z.input` cho kiểu giá trị form, `z.output` cho kiểu sau khi parse.

### 9.3 Ô số hiện sẵn `0` hoặc không xóa được số 0

- Giá trị mặc định của form là `0` thay vì `''`. Dùng `''` cho form mới (xem `EMPTY_PRODUCT_FORM`) và để Zod chuyển `''` → lỗi "bắt buộc" hoặc giá trị mặc định.

### 9.4 Mở form sửa nhưng hiện dữ liệu sản phẩm trước

- `defaultValues` chỉ được đọc lần đầu. Mỗi sản phẩm cần `key={product.id}` cho form hoặc gọi `reset(values)` khi đổi sản phẩm.

### 9.5 Hai lần bấm tạo 2 sản phẩm

- Disable nút khi `isPending` của mutation (Mantine `loading`). Với thao tác quan trọng, nên kiểm tra phía DB (unique, RPC có khóa).

---

## 10. URL state, routing & deploy (Vercel)

### 10.1 F5 hoặc mở link trực tiếp `/products` trên Vercel → `404 NOT_FOUND`

- SPA cần rewrite mọi đường dẫn về `index.html`. Thêm `vercel.json` ở gốc repo:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```

### 10.2 Sau khi deploy bản mới, người dùng đang mở app gặp `Failed to fetch dynamically imported module`

- Route lazy-load trỏ tới file chunk có hash cũ, đã bị thay bằng bản build mới.
- Xử lý: người dùng bấm "Tải lại trang" (đã có trong `RouteErrorBoundary`). Có thể tự động reload một lần khi gặp lỗi này:
  ```ts
  window.addEventListener('vite:preloadError', () => window.location.reload())
  ```

### 10.3 Filter/trang trên URL bị reset hoặc nhảy lung tung

- Giá trị URL không hợp lệ (vd. `?page=abc`) → schema dùng `.catch()` để rơi về mặc định; đó là đúng thiết kế.
- Đổi filter phải **về trang 1** (`useProductFilters` đã làm). Màn hình mới nhớ làm giống.
- Mỗi lần gõ phím tạo một entry lịch sử → dùng `replace: true` cho ô tìm kiếm.

### 10.4 Bản production khác bản ở máy

- Kiểm tra Vercel đang deploy đúng commit/nhánh (Deployments → commit hash).
- Trình duyệt cache `index.html` cũ → hard reload (`Ctrl+Shift+R`).
- Thử build production ở máy: `npm run build && npm run preview`.

---

## 11. Ngày giờ, múi giờ & định dạng tiền

### 11.1 Doanh thu "hôm nay" thiếu đơn buổi sáng / số liệu lệch 1 ngày

- Gộp theo ngày **UTC** thay vì giờ Việt Nam. 7h sáng VN = 0h UTC → đơn từ 0h–7h bị tính vào ngày hôm trước.
- Quy ước: RPC dashboard nhận `p_tz = 'Asia/Ho_Chi_Minh'` và chuyển múi giờ trong SQL; client không tự cắt ngày.
- Chuỗi ngày `YYYY-MM-DD` parse bằng `new Date('2026-11-10')` sẽ hiểu là **UTC** → dùng formatter trong `shared/lib/formatters` (đã xử lý +07:00).

### 11.2 Test ngày tháng xanh ở máy, đỏ trên CI

- CI chạy UTC, máy dev chạy UTC+7. Đặt múi giờ cố định cho test (biến `TZ`) hoặc dùng `vi.setSystemTime` + truyền múi giờ tường minh.

### 11.3 Tiền hiển thị `150000` thay vì `150.000 ₫`, hoặc định dạng không đồng nhất

- Có chỗ tự format bằng `toLocaleString` hoặc nối chuỗi. Bắt buộc dùng `formatCurrency` / `formatNumber` trong `shared/lib/formatters`.
- Lưu tiền là **số nguyên VND** — tránh số thực (`0.1 + 0.2`).

---

## 12. Nhập Excel

| Thông báo / triệu chứng                           | Nguyên nhân                                             | Sửa                                                                           |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Thiếu cột "Giá bán".`                            | Tên cột không khớp tên/biệt danh trong `IMPORT_COLUMNS` | Dùng "Tải file mẫu"; muốn chấp nhận tên mới thì thêm alias + test             |
| `Dòng N: Danh mục "..." không có trong danh sách` | Danh mục không thuộc `PRODUCT_CATEGORIES`               | Chọn đúng danh mục (sheet "Danh mục" trong file mẫu)                          |
| `Giá bán "..." không phải số hợp lệ`              | Ô có chữ, số thập phân, số âm, công thức lỗi `#REF!`    | Sửa ô trong Excel; định dạng Number, không dùng dấu phẩy thập phân            |
| Số dòng báo lỗi lệch với Excel                    | Ô dữ liệu không bắt đầu từ A1 / có dòng trống           | Parser đã tính offset — nếu lệch, thêm test với file tái hiện                 |
| File `.csv` bị lỗi font tiếng Việt                | CSV lưu sai encoding (ANSI)                             | Lưu "CSV UTF-8" hoặc dùng `.xlsx`                                             |
| `tối đa 500 dòng`                                 | Vượt `MAX_IMPORT_ROWS`                                  | Chia nhỏ file                                                                 |
| Nhập xong bấm lưu báo lỗi DB                      | Dữ liệu qua được client nhưng vi phạm CHECK/RLS         | Xem mã lỗi ở mục 5; nhập là "tất cả hoặc không" nên không có sản phẩm nửa vời |

---

## 13. Typecheck, lint, test & CI

### 13.1 Chạy ở máy được, CI báo `Cannot find module './ProductForm'`

- **Windows không phân biệt hoa thường tên file, Linux (CI, Vercel) thì có.** Import `./productForm` trong khi file là `ProductForm.tsx` vẫn chạy trên Windows nhưng gãy trên CI.
- Đổi tên file chỉ khác hoa/thường bằng git: `git mv productForm.tsx ProductForm.tsx`.

### 13.2 `npm run format:check` đỏ trên CI

- Chạy `npm run format` rồi commit. Hook pre-commit (husky + lint-staged) đã tự format — nếu bị bỏ qua (`--no-verify`) sẽ lọt.

### 13.3 Lint fail vì warning (`--max-warnings 0`)

- Không tắt rule bằng `eslint-disable` cho tiện. Thường gặp: `react-hooks/exhaustive-deps` (thiếu deps → dùng `useEffectEvent` hoặc sửa logic), biến không dùng, `any`.

### 13.4 Typecheck lỗi sau khi kéo code mới

- `database.types.ts` chưa đồng bộ với DB → `npm run db:types`.
- `noUncheckedIndexedAccess`: `arr[0]` có kiểu `T | undefined` → kiểm tra trước khi dùng, không dùng `!` bừa.

### 13.5 Test chập chờn (lúc xanh lúc đỏ)

- Dùng `getBy` cho phần tử xuất hiện bất đồng bộ → đổi sang `findBy` / `waitFor`.
- Test phụ thuộc thứ tự / dữ liệu dùng chung giữa test → `mockReset` trong `beforeEach`.
- Hiệu ứng Mantine (transition) → render với `env="test"` (đã cấu hình trong `renderWithProviders`).
- API trình duyệt jsdom không có (`matchMedia`, `ResizeObserver`, `URL.createObjectURL`) → stub trong `src/test/setup.ts`.
- Chạy lặp để xác nhận đã hết chập chờn: `npx vitest run <file> --repeat 5` (hoặc chạy nhiều lần).

### 13.6 Commit bị từ chối bởi commitlint

- Message phải theo Conventional Commits: `feat(products): ...`, `fix(orders): ...`, `docs: ...`. Subject viết thường, không dấu chấm cuối.

---

## 14. Hiệu năng

| Triệu chứng                        | Kiểm tra                                         | Sửa                                                                                                                          |
| ---------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Danh sách tải chậm khi dữ liệu lớn | Supabase → Query Performance / `explain analyze` | Thêm index cho cột lọc/sắp xếp; luôn phân trang server-side; `count: 'exact'` tốn kém trên bảng rất lớn → cân nhắc `planned` |
| Tìm kiếm `ilike '%từ%'` chậm       | `explain` thấy _Seq Scan_                        | Index `pg_trgm` (GIN) cho `name`, `sku`                                                                                      |
| Gõ tìm kiếm gửi request mỗi phím   | Network                                          | Debounce 300ms (đã có)                                                                                                       |
| Bundle lớn, tải trang đầu chậm     | `npm run build` xem kích thước chunk             | Lazy-load route; import động thư viện nặng (đã làm với `xlsx`)                                                               |
| UI giật khi gõ trong bảng lớn      | React DevTools Profiler                          | Tránh tạo object/hàm mới truyền xuống hàng loạt; tách component dòng; memo khi đo thấy cần                                   |
| Dashboard gọi nhiều query nặng     | Network                                          | Gộp phép tính vào RPC SQL (đã làm) và đặt `staleTime` hợp lý                                                                 |

---

## 15. Sự cố production: xử lý khẩn

1. **Đánh giá mức độ**: toàn bộ người dùng hay một số? Mất dữ liệu hay chỉ hiển thị sai?
2. **Cầm máu trước, tìm gốc sau**:
   - Lỗi do deploy mới → Vercel → Deployments → chọn bản trước → **Promote to Production / Instant Rollback**.
   - Lỗi do migration → **không** xóa migration; viết migration sửa (forward fix). Trước migration rủi ro, sao lưu (Supabase → Database → Backups).
   - Nghi lộ key: vào Supabase → Project Settings → API → **rotate** key ngay, cập nhật env trên Vercel, redeploy.
3. Ghi lại dòng thời gian (phát hiện lúc nào, làm gì, khi nào hết).
4. Sau sự cố: tìm nguyên nhân gốc, thêm test/kiểm tra để chặn tái diễn, cập nhật tài liệu này.

---

## 16. Bảng tra nhanh mã lỗi

| Mã                                                                | Nguồn             | Ý nghĩa ngắn                                                                                           | Xem                                                                                                              |
| ----------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `401`                                                             | Auth/PostgREST    | Chưa đăng nhập / JWT hết hạn                                                                           | [4.4](#44-đang-dùng-thì-mọi-request-trả-401--jwt-expired)                                                        |
| `403`                                                             | Storage/PostgREST | Bị policy chặn                                                                                         | [5.2](#52-42501-new-row-violates-row-level-security-policy), [6](#6-upload-ảnh-supabase-storage)                 |
| `404` (route)                                                     | Vercel            | Thiếu rewrite SPA                                                                                      | [10.1](#101-f5-hoặc-mở-link-trực-tiếp-products-trên-vercel--404-not_found)                                       |
| `42501`                                                           | Postgres          | RLS / thiếu GRANT                                                                                      | [5.2](#52-42501-new-row-violates-row-level-security-policy), [5.3](#53-42501-permission-denied-for-tablecolumn-) |
| `23505`                                                           | Postgres          | Trùng unique                                                                                           | [5.6](#56-lỗi-ràng-buộc-dữ-liệu)                                                                                 |
| `23503`                                                           | Postgres          | Vi phạm khóa ngoại                                                                                     | [5.6](#56-lỗi-ràng-buộc-dữ-liệu)                                                                                 |
| `23514`                                                           | Postgres          | Vi phạm CHECK                                                                                          | [5.6](#56-lỗi-ràng-buộc-dữ-liệu)                                                                                 |
| `22P02`                                                           | Postgres          | Sai kiểu dữ liệu (vd. uuid không hợp lệ)                                                               | Kiểm tra tham số gửi lên                                                                                         |
| `PGRST116`                                                        | PostgREST         | `.single()` nhận 0 hoặc >1 dòng                                                                        | Dùng `.maybeSingle()` khi có thể không có dòng                                                                   |
| `PGRST103`                                                        | PostgREST         | Offset phân trang vượt số dòng                                                                         | [7.5](#75-đang-ở-trang-5-xóa-hết-sản-phẩm-trang-đó--trang-trống)                                                 |
| `PGRST202`                                                        | PostgREST         | Không tìm thấy RPC                                                                                     | [5.4](#54-gọi-rpc-báo-pgrst202-could-not-find-the-function--hoặc-404)                                            |
| `PGRST204`                                                        | PostgREST         | Cột không tồn tại (schema cache cũ / chưa migrate)                                                     | `db:push`, `notify pgrst, 'reload schema'`                                                                       |
| `INSUFFICIENT_STOCK`, `ORDER_NOT_PENDING`, `PRODUCT_IN_ORDERS`, … | RPC của dự án     | Lỗi nghiệp vụ                                                                                          | [5.5](#55-lỗi-nghiệp-vụ-từ-rpc-mã-do-mình-raise)                                                                 |
| `Failed to fetch`                                                 | Trình duyệt       | Mất mạng, sai URL Supabase, project Supabase bị **pause** (gói free tạm dừng sau thời gian không dùng) | Kiểm tra mạng, env, vào dashboard _Restore project_                                                              |

---

## 17. Mẫu báo cáo bug & checklist sau khi sửa

### Mẫu báo cáo (dán vào issue)

```markdown
**Mô tả ngắn**: ...
**Môi trường**: production / preview / local — trình duyệt, thiết bị
**URL**: https://.../products?page=2&q=ao
**Các bước tái hiện**:

1. ...
2. ...
   **Kết quả mong đợi**: ...
   **Kết quả thực tế**: ... (ảnh chụp, thông báo lỗi nguyên văn)
   **Console / Network**: (dán lỗi, mã `code` trong response)
   **Tần suất**: luôn luôn / thỉnh thoảng / một lần
```

### Checklist trước khi đóng bug

- [ ] Đã tìm ra nguyên nhân gốc (ghi lại trong PR).
- [ ] Có test tái hiện bug (đỏ trước khi sửa, xanh sau khi sửa) nếu là logic/business rule.
- [ ] Mã lỗi mới (nếu có) đã được map sang thông báo tiếng Việt.
- [ ] Đủ trạng thái loading / empty / error ở màn hình liên quan.
- [ ] Không tắt RLS, không dùng service_role, không `any`, không `eslint-disable` để lách.
- [ ] Đổi DB → có migration mới + `npm run db:types` + commit types.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` đều xanh.
- [ ] Commit `fix(<scope>): ...`, PR mô tả nguyên nhân & cách kiểm chứng.
- [ ] Cập nhật tài liệu này nếu đây là loại lỗi mới.
