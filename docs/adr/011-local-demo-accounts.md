# ADR 011: Tài khoản dùng thử chạy hoàn toàn trong trình duyệt (admintest / sellertest)

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-20

## Bối cảnh

Nhà tuyển dụng / người xem portfolio cần thử ngay cả hai vai trò (seller và admin) mà không phải đăng ký, xác minh email hay chờ duyệt hồ sơ. Yêu cầu:

- Hai tài khoản cố định: `admintest / admintest001` và `sellertest / sellertest01`.
- Mọi dữ liệu chỉ lưu cục bộ, **không ghi vào database**. Đóng tab là đặt lại.
- Thử được trọn luồng nghiệp vụ: tạo / xác nhận / hủy đơn (trừ, hoàn kho), nhập hàng, điều chỉnh kho, báo cáo; admin duyệt hồ sơ, khóa tài khoản, xóa tài khoản.

## Quyết định

**Backend giả lập ở lớp `api/`, không mock Supabase client.** Mỗi feature có thêm `api/<x>.demo.ts` với các hàm cùng tên, cùng kiểu với `<x>.api.ts`. Mỗi hàm thật mở đầu bằng:

```ts
if (isDemoMode()) return (await demo()).fetchOrders(sellerId, filters)
```

- `demo()` là dynamic import: code giả lập và dữ liệu mẫu tách chunk riêng, người dùng thật không tải.
- TypeScript kiểm tra hàm demo trả đúng kiểu của hàm thật. Component, hook, query key không biết có chế độ demo.
- Giả lập PostgREST (chuỗi `.select().eq().or()…`, quan hệ lồng) phức tạp và dễ sai hơn nhiều so với viết lại từng hàm.

**Dữ liệu** (`shared/lib/demo/`):

- `demoDb.ts`: các bảng giống schema (type sinh từ Supabase), lưu một khối JSON trong `sessionStorage`. Mỗi lần ghi chạy trên bản sao và chỉ thay thế khi thành công, giống transaction rollback khi RPC `raise exception`.
- `demoSeed.ts`: dữ liệu mẫu sinh bằng PRNG có seed cố định, mốc thời gian dịch theo ngày hiện tại. Số liệu nhất quán: tồn kho = tổng `inventory_movements`, đơn đã xác nhận có giá vốn chốt, phiếu nhập cập nhật giá vốn bình quân gia quyền. Có sẵn shop chờ duyệt, shop bị tạm khóa, tài khoản trong thùng rác để thử Admin Console.
- `demoSession.ts`: phiên demo (cờ trong `sessionStorage`), phát sự kiện `SIGNED_IN` / `SIGNED_OUT` giống `onAuthStateChange`.
- `demoFiles.ts`: ảnh / giấy tờ tải lên lưu dạng data URL (≤ 400 KB) hoặc chỉ trong bộ nhớ.

**Quy tắc nghiệp vụ và phân quyền giữ như RPC thật:** `require_admin`, `require_approved_seller`, `resolve_report_seller`; mã lỗi giống hệt (`INSUFFICIENT_STOCK`, `ORDER_NOT_PENDING`, `NOT_ADMIN`, `FORBIDDEN`…), nên thông báo tiếng Việt không phải viết lại. Hành động admin vẫn ghi `audit_logs`.

**Bật / tắt:** mặc định bật; `VITE_DEMO_ACCOUNTS=false` để tắt hẳn (form đăng nhập không còn khối "Tài khoản dùng thử", tên `admintest` / `sellertest` không còn được chấp nhận).

## Lý do

- Không đụng database: không có rủi ro dữ liệu demo lẫn với shop thật, không cần job dọn dẹp, không ai phá được dữ liệu của người khác.
- Mỗi tab có bộ dữ liệu riêng: nhiều người thử cùng lúc không ảnh hưởng nhau.

## Đánh đổi

- **Quy tắc nghiệp vụ có hai bản** (SQL và TypeScript giả lập). Bản giả lập _chỉ_ dùng cho demo. Nguồn sự thật vẫn là RPC Postgres; quy tắc "không trừ kho từ client" trong CLAUDE.md áp dụng cho dữ liệu thật. Khi sửa RPC phải sửa `*.demo.ts` tương ứng. `testcase/unit/demo/demoBackend.test.ts` kiểm tra các quy tắc chính (trừ / hoàn kho, thiếu hàng, giá vốn bình quân, phân quyền).
- Mật khẩu demo nằm trong bundle. Chấp nhận được vì tài khoản demo chỉ mở dữ liệu giả của chính tab, không có phiên Supabase, không gọi được API thật.
- Không có Realtime / email thật: thông báo xóa tài khoản chỉ được đánh dấu "đã gửi".
- File Excel gốc của lần nhập sản phẩm chỉ giữ trong bộ nhớ: tải lại trang thì không tải lại file gốc được.
