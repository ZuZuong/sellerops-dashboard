# ADR 006: Đa seller dùng chung database, tách dữ liệu bằng `seller_id` + RLS

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-25

## Bối cảnh

SellerOps chuyển từ "mỗi tài khoản tự quản lý kho của mình" sang nền tảng nhiều seller có admin duyệt hồ sơ. Dữ liệu kinh doanh (sản phẩm, đơn, kho, phiếu nhập, khách đã lưu…) phải tách tuyệt đối giữa các shop. Shop chưa được duyệt hoặc bị khóa không được đọc / ghi dữ liệu kinh doanh, kể cả khi gọi thẳng API.

## Quyết định

- **Một database, một schema**. Mọi bảng dữ liệu shop có cột `seller_id` tham chiếu `sellers.id`. Bảng con (`order_items`, `purchase_receipt_items`) thuộc shop qua bảng cha.
- **RLS là lớp chặn thật**:
  - Seller đọc / ghi khi `seller_id = current_approved_seller_id()`. Hàm này trả `null` nếu shop chưa `approved` hoặc tài khoản bị khóa.
  - Admin chỉ có policy `SELECT`.
- **RPC ghi dữ liệu** (`security definer`) mở đầu bằng `require_approved_seller()`, raise mã lỗi rõ ràng (`SELLER_NOT_APPROVED`, `ACCOUNT_LOCKED`…).
- **Khóa ngoại kép** `products (seller_id, category_id) → categories (seller_id, id)`: sản phẩm không thể trỏ tới danh mục của shop khác, ràng buộc ngay ở database.
- **Hàm báo cáo nhận `p_seller_id`**, bỏ trống thì là shop của người gọi. Seller truyền id shop khác bị `FORBIDDEN`. Admin truyền id nào thì chỉ thấy đúng shop đó.
  - Lọc tường minh, không dựa vào RLS, vì admin đọc được mọi shop: nếu chỉ dựa vào RLS thì báo cáo sẽ cộng dồn mọi shop.
  - Viết bằng plpgsql để bước kiểm tra quyền luôn chạy (hàm SQL thuần có thể bỏ qua subquery khi bảng rỗng).
- **Storage** theo thư mục:
  - Ảnh sản phẩm và file import: `{seller_id}/…`.
  - Giấy tờ hồ sơ: `{owner_id}/{kind}/…` (xem ADR 009).
- Các helper phân quyền là hàm `security definer` gọn, bọc trong `(select …)` trong policy để Postgres tính một lần mỗi câu truy vấn.

## Lý do

- Một codebase, một lần migrate, truy vấn tổng hợp toàn nền tảng cho admin đơn giản (một câu SQL).
- RLS đặt quyền ở nơi dữ liệu nằm: dù client có lỗi hay ai đó gọi thẳng PostgREST, database vẫn chặn.
- `seller_id` thay vì `user_id` tách "người dùng" khỏi "shop": sau này một shop có nhiều nhân viên chỉ cần thêm bảng thành viên, không phải đổi khóa dữ liệu.

## Đánh đổi

- Mỗi truy vấn chịu thêm điều kiện RLS. Đã thêm index `(seller_id, …)` cho mọi bảng và index cho khóa ngoại dùng trong policy qua bảng cha.
- Sai sót trong một policy hoặc một hàm `security definer` có thể làm lộ dữ liệu giữa các shop. Giảm rủi ro bằng `testcase/db/rls_checks.sql`, chạy sau mỗi migration.
- Không cô lập được tài nguyên giữa các shop (một shop lớn ảnh hưởng hiệu năng chung). Chấp nhận được ở quy mô dự án. Phương án schema hoặc database riêng mỗi shop đắt hơn nhiều về vận hành.
