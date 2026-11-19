# ADR 008: Admin xem shop ở chế độ chỉ đọc, không impersonation

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-26

## Bối cảnh

Admin cần xem dashboard của từng shop (sản phẩm, danh mục, đơn hàng, tồn kho, phân tích) để xét duyệt và xử lý vi phạm. Có hai cách phổ biến: đăng nhập thay seller (impersonation) hoặc dùng lại giao diện seller ở chế độ chỉ đọc.

## Quyết định

- Không impersonation. Admin luôn dùng phiên của chính mình.
- `SellerScopeProvider` cung cấp `{ sellerId, readOnly }` cho cây component:
  - Route seller (`/seller/*`): `sellerId` = shop của người đăng nhập, `readOnly = false`.
  - Route admin (`/admin/sellers/:sellerId`): `sellerId` lấy từ URL, `readOnly = true`, kèm banner "Đang xem với tư cách Admin, chỉ đọc".
- Component dữ liệu shop đọc `sellerId` từ context. Mọi query key chứa `sellerId`, truy vấn bảng lọc tường minh `seller_id`, hàm báo cáo nhận `p_seller_id`.
- Khi `readOnly`, component ẩn mọi nút ghi (thêm / sửa / xóa / sửa nhanh / chuyển trạng thái / điều chỉnh kho) và link sang trang chỉ dành cho seller.
- Hành động của admin (duyệt, từ chối, khóa, xóa) chỉ đi qua RPC `require_admin()` + ghi `audit_logs`.

## Lý do

- Impersonation khiến audit log không phân biệt được ai thật sự thao tác, và cần cơ chế cấp token thay người dùng (service_role ở server).
- Dùng lại đúng component của seller: không nhân đôi code, giao diện admin luôn khớp với thứ seller thấy.
- Lớp chặn thật nằm ở database: RLS chỉ cho admin **đọc** dữ liệu kinh doanh, RPC ghi đều gọi `require_approved_seller()`. Ẩn nút chỉ phục vụ trải nghiệm.

## Đánh đổi

- Mỗi component có nút ghi phải nhớ kiểm tra `readOnly`. Có test component bảo đảm chế độ chỉ đọc ẩn nút ghi ở Sản phẩm, Danh mục, Đơn hàng, Tồn kho.
- RLS cho admin đọc mọi shop nên **bắt buộc** lọc tường minh theo `seller_id`, nếu không màn hình một shop sẽ lẫn dữ liệu shop khác.
- Một số trang con của seller (chi tiết đơn, phiếu nhập) chưa có bản admin. Ở chế độ chỉ đọc, mã chứng từ hiển thị dạng chữ, không có link.
