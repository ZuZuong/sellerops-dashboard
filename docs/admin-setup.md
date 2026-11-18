# Thiết lập tài khoản admin

SellerOps **không có luồng đăng ký admin trên giao diện**. Role nằm trong bảng `public.profiles`, client không tự đổi được (xem [ADR 007](adr/007-role-in-profiles-not-metadata.md)). Admin đầu tiên được gán tay bằng SQL Editor, chạy với quyền `postgres`.

## Điều kiện

- Đã chạy các migration đa seller (`20261125000000` → `20261125000200`).
- Tài khoản dự định làm admin đã đăng ký (có trong **Authentication → Users**) và đã xác minh email.
- Tài khoản đó **chưa** đăng ký shop. Một người dùng chỉ có một vai trò. Nếu email đã có shop thì dùng email khác cho admin.

## Gán admin

Supabase Dashboard → **SQL Editor** → dán đoạn dưới, thay `<email-admin>` bằng email thật của bạn (chỉ điền trong SQL Editor, **không** commit vào repo) → **Run**.

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = '<email-admin>'
on conflict (id) do update set role = 'admin';
```

Kết quả `INSERT 0 1` là thành công. `INSERT 0 0` nghĩa là không tìm thấy email (kiểm tra lại chính tả, chữ hoa thường).

## Kiểm tra

```sql
select u.email, p.role, p.is_locked
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
```

Đăng xuất rồi đăng nhập lại để giao diện đọc role mới.

## Gỡ quyền admin

```sql
update public.profiles set role = 'customer'
where id = (select id from auth.users where email = '<email-admin>');
```

## Lưu ý bảo mật

- Không gán admin bằng `user_metadata` / `app_metadata`: database không dùng hai trường này để phân quyền.
- Admin không thể khóa chính mình hay admin khác (`set_account_locked` chặn), nên luôn giữ ít nhất **một** admin không bị khóa.
- Mọi hành động của admin (duyệt, từ chối, khóa / mở khóa) được ghi vào `audit_logs`.
