# ADR 010: Xóa tài khoản là xóa mềm, đá người dùng ra bằng Realtime, thông báo qua Edge Function

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-26

## Bối cảnh

Admin cần xóa tài khoản seller vi phạm, kèm lý do và bằng chứng. Yêu cầu:

- Seller đang dùng dashboard bị đá ra trang đăng nhập ngay lập tức.
- Seller nhận email nêu lý do và cách khiếu nại để hai bên giải quyết.
- Có hàng "chờ xác nhận xóa"; khiếu nại thành công thì khôi phục được.

## Quyết định

**Xóa mềm, không bao giờ xóa vĩnh viễn.** `profiles.account_status`: `active → pending_deletion → deleted`, khôi phục được từ cả hai trạng thái.

- `request_account_deletion` (admin): tạo `account_deletions` (lý do, bằng chứng, người thực hiện, trạng thái khóa trước đó), đặt `pending_deletion` và `is_locked = true` trong một transaction, ghi `audit_logs`.
- `confirm_account_deletion`: `pending_deletion → deleted`. Dữ liệu shop giữ nguyên.
- `restore_account`: trả về đúng trạng thái khóa trước khi xóa.
- `set_account_locked` từ chối tài khoản đang chờ xóa / đã xóa, tránh vô tình mở khóa.
- Không xóa được chính mình hay admin khác.

**Đá ra ngay.** Database tước quyền tức thì: mọi helper phân quyền đều xét `is_locked`. Giao diện nghe Supabase Realtime trên dòng `profiles` (và `sellers`) của chính người dùng. Realtime tôn trọng RLS "select own", nên mỗi người chỉ nhận thay đổi của mình. Khi `account_status ≠ active`, `AccountGate` đăng xuất và trang đăng nhập hiện thông báo. Quay lại tab cũng kiểm tra lại (dự phòng khi mất kết nối Realtime).

**Email qua Edge Function `notify-account-deletion`.** Client chỉ gửi `deletion_id`. Function gọi RPC bằng JWT của người gọi (chỉ admin đọc được), tự dựng người nhận và nội dung (có escape HTML), gửi qua Resend, rồi ghi `notified_at` / `notify_error`. Gửi lỗi không làm hỏng việc xóa: admin gửi lại được ở mục "Chờ xóa".

## Lý do

- Xóa cứng làm mất căn cứ giải quyết khiếu nại và chứng từ kế toán (đơn hàng, phiếu nhập).
- Chỉ dựa vào polling thì seller có thể tiếp tục thấy giao diện tới vài chục giây. Realtime cho phản hồi khoảng 1 giây mà không thêm hạ tầng.
- Function nhận HTML / người nhận từ client sẽ thành công cụ gửi spam bằng tên miền của nền tảng.

## Đánh đổi

- Bỏ "realtime" khỏi danh sách ngoài phạm vi, nhưng chỉ dùng cho trạng thái tài khoản / shop của chính người dùng, không dùng cho dữ liệu kinh doanh.
- Tài khoản "đã xóa" vẫn chiếm email trong `auth.users`: người đó không đăng ký lại được bằng email cũ.
- Email phụ thuộc cấu hình Resend: chưa xác minh domain thì chỉ gửi được tới email chủ tài khoản Resend.
