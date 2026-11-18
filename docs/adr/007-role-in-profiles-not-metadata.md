# ADR 007: Role lưu trong `profiles`, không dùng metadata của Supabase Auth

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-25

## Bối cảnh

Hệ thống có ba vai trò: `admin`, `seller`, `customer`. Supabase Auth có sẵn `user_metadata` (client tự ghi qua `updateUser`) và `app_metadata` (chỉ server ghi, nằm trong JWT). Cần một nơi lưu role mà người dùng **không thể tự nâng quyền**, và quyền phải có hiệu lực ngay khi admin khóa tài khoản.

## Quyết định

- Bảng `public.profiles (id = auth.users.id, role, is_locked, …)`. Trigger tạo dòng khi có user mới, mặc định `customer`.
- `role` và `is_locked` **không có quyền UPDATE** cho `authenticated` (quyền theo cột chỉ mở `full_name`, `phone`). Chỉ đổi được qua:
  - `register_as_seller()`: `customer` → `seller`, từ chối admin và tài khoản bị khóa.
  - `set_account_locked()`: chỉ admin gọi được, ghi `audit_logs`, không khóa được chính mình hay admin khác.
  - SQL Editor với quyền `postgres` để tạo admin đầu tiên (`docs/admin-setup.md`).
- Mọi helper phân quyền (`is_admin`, `current_seller_id`, `current_approved_seller_id`…) đọc `profiles` mỗi lần gọi và xét `is_locked`.

## Lý do

- `user_metadata` do client ghi được: dùng để phân quyền là lỗ hổng leo thang đặc quyền kinh điển.
- `app_metadata` an toàn hơn nhưng nằm trong JWT. Khóa tài khoản hay đổi role chỉ có hiệu lực khi token hết hạn (mặc định 1 giờ). Đổi role cũng phải qua Admin API với `service_role` key, không được đưa vào frontend.
- Đọc từ bảng thì quyền đổi **ngay lập tức**, có RLS, có audit, và test được bằng SQL (`rls_checks.sql`).

## Đánh đổi

- Mỗi lần kiểm tra quyền tốn thêm một truy vấn nhỏ theo khóa chính. Policy bọc helper trong `(select …)` để mỗi câu truy vấn chỉ tính một lần.
- Giao diện phải tự đọc `profiles` để biết role (không có sẵn trong session). Phase 2 thêm hook riêng và cache bằng TanStack Query.
