# Cấu hình Supabase Auth cho luồng đăng ký seller

Luồng đăng ký / quên mật khẩu (Phase 2) cần vài cấu hình trên Supabase Dashboard. Không có bước nào cần sửa code hay `.env`.

## 1. Bật xác minh email

**Authentication → Sign In / Providers → Email**

- Bật **Confirm email**: seller phải mở link trong thư mới đăng nhập được, và email đó dùng được cho chức năng quên mật khẩu.
- Độ dài mật khẩu tối thiểu: đặt **8** cho khớp với form (form đã kiểm tra, server kiểm tra lại).

## 2. Site URL và Redirect URLs

**Authentication → URL Configuration**

- **Site URL**: domain production trên Vercel, ví dụ `https://<ten-du-an>.vercel.app`.
- **Redirect URLs**: thêm đủ các dòng sau (cả localhost lẫn Vercel):

```
http://localhost:5173/
http://localhost:5173/reset-password
https://<ten-du-an>.vercel.app/
https://<ten-du-an>.vercel.app/reset-password
```

Link xác minh email quay về `/` (app tự chuyển hướng theo vai trò). Link đặt lại mật khẩu quay về `/reset-password`. URL không có trong danh sách sẽ bị Supabase thay bằng Site URL, khi đó luồng hiển thị sai trang.

Nếu dùng preview deployment của Vercel, có thể thêm mẫu `https://<ten-du-an>-*.vercel.app/**`.

## 3. SMTP

SMTP mặc định của Supabase giới hạn rất ít thư mỗi giờ, chỉ đủ để thử. Khi demo cho người khác dùng, cấu hình SMTP riêng tại **Authentication → Emails → SMTP Settings** (Resend, Brevo, SendGrid…). Không đưa thông tin SMTP vào repo.

## 4. Kiểm tra nhanh

1. Mở `/register`, đăng ký bằng một email thật **khác** email admin.
2. Mở thư, bấm link → được đưa vào `/seller` với modal "Hoàn tất hồ sơ kinh doanh".
3. Đăng xuất, mở `/forgot-password`, nhập email → nhận thư → link mở `/reset-password` → đặt mật khẩu mới.
4. Mở lại link đặt lại mật khẩu lần thứ hai → trang báo link đã hết hạn / đã dùng.

## Vì sao seller được tạo sau khi xác minh email

Form đăng ký ghi `signup_intent = 'seller'` vào `user_metadata`. Đây **chỉ là dấu hiệu** để client biết cần gọi `register_as_seller()` khi người dùng đăng nhập lần đầu sau xác minh. Quyền thật do RPC quyết định (từ chối nếu chưa xác minh email, là admin, hoặc tài khoản bị khóa; gọi lại trả về đúng shop đã có) và role luôn đọc từ bảng `profiles`.
