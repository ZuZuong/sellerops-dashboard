# ADR 009: Giấy tờ và bằng chứng vi phạm ở bucket riêng tư, xem bằng signed URL ngắn hạn

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-26

## Bối cảnh

Hồ sơ seller chứa giấy phép kinh doanh, giấy tờ tùy thân của người đại diện. Khi xóa tài khoản, admin đính kèm bằng chứng vi phạm (ảnh chụp, tài liệu). Đây là dữ liệu nhạy cảm, không được để lộ qua link công khai.

## Quyết định

- Hai bucket **private**, giới hạn dung lượng và loại file ngay ở bucket:
  - `seller-documents` (5 MB, PDF/JPG/PNG). Đường dẫn `{owner_id}/{kind}/{timestamp}-{tên}`. Chủ shop tải lên / đọc / xóa khi hồ sơ còn sửa được (`draft`, `rejected`). Admin chỉ đọc.
  - `violation-evidence` (10 MB, PDF/JPG/PNG/WEBP). Đường dẫn `{user_id}/{uuid}-{tên}`. Chỉ admin tải lên và đọc. Chỉ xóa được file **chưa** gắn vào hồ sơ xóa (dọn file khi thao tác lỗi). Bằng chứng đã nộp không ai sửa / xóa được.
- Admin xem file bằng signed URL hết hạn sau **60 giây**, tạo ngay lúc bấm "Xem".
- Tên file được làm sạch (`shared/lib/fileName.ts`), không cho đường dẫn hay ký tự đặc biệt lọt vào key Storage.
- RPC `request_account_deletion` kiểm tra file bằng chứng nằm đúng thư mục của tài khoản bị xóa **và** đã thật sự tồn tại trong bucket.

## Lý do

- Bucket public: ai có link là xem được mãi mãi, không thu hồi được.
- Signed URL ngắn hạn: link vô tình chia sẻ ra ngoài cũng nhanh chóng vô hiệu. Quyền tạo link vẫn do RLS của `storage.objects` quyết định.
- Giới hạn loại / dung lượng ở bucket: client kiểm tra để báo lỗi sớm, server vẫn chặn khi gọi thẳng API.

## Đánh đổi

- Mỗi lần xem tốn một request tạo signed URL. Trình duyệt chặn popup nếu mở tab sau khi chờ mạng, nên tab được mở ngay lúc bấm rồi mới trỏ tới URL.
- Ảnh không cache lâu được ở trình duyệt (URL đổi mỗi lần). Chấp nhận được vì đây là thao tác hiếm của admin.
