-- =============================================================================
-- KIỂM TRA một email đang gắn với những gì (CHỈ ĐỌC, không thay đổi dữ liệu).
--
-- Cách dùng: Supabase Dashboard → SQL Editor → dán file → thay <email> ở dòng `with target`
-- → Run. Kết quả là MỘT bảng, mỗi dòng là một "thứ" liên quan tới email đó.
--
-- Đọc kết quả:
--   * loai = 'tai_khoan'      → tài khoản đăng nhập ĐANG TỒN TẠI với email này.
--       trang_thai = active             → tài khoản đang hoạt động
--       trang_thai = pending_deletion   → đang trong THÙNG RÁC (email còn bị giữ, đăng ký lại sẽ
--                                          vào lại đúng tài khoản này) → bấm "Xóa vĩnh viễn"
--   * loai = 'shop_hien_tai'  → shop của tài khoản đang tồn tại
--   * loai = 'shop_cu'        → shop của tài khoản ĐÃ XÓA VĨNH VIỄN (chỉ còn dữ liệu dạng chữ)
--   * loai = 'ho_so_xoa'      → lịch sử xóa: pending = trong thùng rác, confirmed = đã xóa vĩnh
--                               viễn, restored = đã khôi phục
-- Không có dòng 'tai_khoan' → email đã được giải phóng, đăng ký lại sẽ ra tài khoản mới (id mới).
-- =============================================================================

with target as (select lower(btrim('<email>')) as email)
select 'tai_khoan' as loai, u.id as id, u.email::text as email,
       p.account_status::text as trang_thai, p.role::text as ghi_chu, u.created_at as thoi_diem
from auth.users u
left join public.profiles p on p.id = u.id, target t
where lower(u.email) = t.email

union all
select 'shop_hien_tai', s.id, u.email::text, s.status::text, s.shop_name, s.created_at
from public.sellers s
join auth.users u on u.id = s.owner_id, target t
where lower(u.email) = t.email

union all
select 'shop_cu', s.id, s.former_owner_email, s.status::text,
       coalesce(s.shop_name, '(chưa đặt tên)') || ' · chủ cũ id ' || s.former_owner_id::text,
       s.owner_removed_at
from public.sellers s, target t
where s.owner_id is null and lower(s.former_owner_email) = t.email

union all
select 'ho_so_xoa', d.id, d.email, d.status::text,
       'id tài khoản cũ ' || d.former_user_id::text
         || case when d.user_id is null then ' (đã xóa vĩnh viễn)' else ' (tài khoản còn tồn tại)' end,
       d.requested_at
from public.account_deletions d, target t
where lower(d.email) = t.email

order by thoi_diem;
