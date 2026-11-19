-- =============================================================================
-- XÓA SẠCH MỌI THỨ gắn với MỘT email để làm lại từ đầu (dùng khi TEST). KHÔNG THỂ HOÀN TÁC.
--
-- Khác với "Xóa vĩnh viễn" trong Admin Console (xóa tài khoản đăng nhập nhưng GIỮ dữ liệu shop),
-- script này xóa luôn cả dữ liệu, để email trở về trạng thái như chưa từng đăng ký.
--
-- Xóa:
--   * tài khoản đăng nhập có email này (auth.users → profiles, phiên đăng nhập, nhật ký thông báo)
--   * shop HIỆN TẠI của tài khoản đó + shop CŨ (của tài khoản cùng email đã xóa vĩnh viễn trước đó)
--     cùng TOÀN BỘ dữ liệu kinh doanh: sản phẩm, danh mục, đơn hàng, khách đã lưu, phiếu nhập,
--     lịch sử kho, thùng rác sản phẩm, lịch sử import, giấy tờ hồ sơ, bộ đếm mã
--   * hồ sơ xóa tài khoản (+ danh sách bằng chứng) của email này
--   * dòng audit_logs có đối tượng là các tài khoản / shop trên
-- KHÔNG xóa: tài khoản / dữ liệu của email khác; hành động mà tài khoản này thực hiện với tư cách
-- admin (không áp dụng cho seller).
--
-- STORAGE — SQL không xóa được file, xóa tay nếu muốn (không bắt buộc, file mồ côi vô hại):
--   Dashboard → Storage → các bucket product-images, product-imports (thư mục = id shop),
--   seller-documents, violation-evidence (thư mục = id tài khoản). Script in ra các id này.
--
-- Cách dùng: SQL Editor → dán file → điền email vào v_email, đổi v_confirm thành 'XOA SACH' → Run.
-- Nên chạy supabase/scripts/inspect_account.sql trước để xem sẽ xóa những gì.
-- =============================================================================

do $$
declare
  v_email    text := lower(btrim('<email>'));
  v_confirm  text := 'KHONG';
  v_users    uuid[];
  v_sellers  uuid[];
  v_count    bigint;
begin
  if v_confirm <> 'XOA SACH' then
    raise exception 'Chưa xác nhận: đổi v_confirm thành ''XOA SACH'' để xóa. Chưa xóa gì.';
  end if;
  if v_email = '' or v_email = '<email>' or position('@' in v_email) = 0 then
    raise exception 'Chưa điền email hợp lệ vào v_email.';
  end if;

  -- Mọi id tài khoản từng dùng email này: tài khoản đang tồn tại + tài khoản đã xóa vĩnh viễn.
  select coalesce(array_agg(distinct x.id), '{}') into v_users
  from (
    select u.id from auth.users u where lower(u.email) = v_email
    union select d.former_user_id from public.account_deletions d where lower(d.email) = v_email
    union select s.former_owner_id from public.sellers s
      where s.former_owner_id is not null and lower(s.former_owner_email) = v_email
  ) x;

  -- Admin không bị xóa bằng script này.
  if exists (
    select 1 from public.profiles p where p.id = any (v_users) and p.role = 'admin'
  ) then
    raise exception 'Email % là tài khoản ADMIN — script không xóa admin.', v_email;
  end if;

  select coalesce(array_agg(s.id), '{}') into v_sellers
  from public.sellers s
  where s.owner_id = any (v_users) or s.former_owner_id = any (v_users);

  raise notice 'Tài khoản (id, cũng là thư mục Storage seller-documents / violation-evidence): %', v_users;
  raise notice 'Shop (id, cũng là thư mục Storage product-images / product-imports): %', v_sellers;

  -- 1. Dữ liệu kinh doanh của các shop (bảng con trước, bảng cha sau).
  delete from public.inventory_movements where seller_id = any (v_sellers);
  delete from public.order_status_events where seller_id = any (v_sellers);
  delete from public.order_items where order_id in (select o.id from public.orders o where o.seller_id = any (v_sellers));
  delete from public.orders where seller_id = any (v_sellers);
  delete from public.customers where seller_id = any (v_sellers);
  delete from public.purchase_receipt_items
    where receipt_id in (select r.id from public.purchase_receipts r where r.seller_id = any (v_sellers));
  delete from public.purchase_receipts where seller_id = any (v_sellers);
  delete from public.products where seller_id = any (v_sellers);
  delete from public.product_trash where seller_id = any (v_sellers);
  delete from public.product_imports where seller_id = any (v_sellers);

  -- 2. Hồ sơ xóa + nhật ký về các tài khoản / shop này.
  delete from public.account_deletions where former_user_id = any (v_users) or lower(email) = v_email;
  delete from public.audit_logs where target_id = any (v_users) or target_id = any (v_sellers);

  -- 3. Shop (danh mục, giấy tờ, bộ đếm xóa theo khóa ngoại).
  delete from public.sellers where id = any (v_sellers);
  get diagnostics v_count = row_count;
  raise notice 'Đã xóa % shop.', v_count;

  -- 4. Tài khoản đăng nhập (profiles, phiên đăng nhập, nhật ký thông báo xóa theo).
  delete from auth.users where id = any (v_users);
  get diagnostics v_count = row_count;
  raise notice 'Đã xóa % tài khoản đăng nhập. Email % đã sạch, đăng ký lại sẽ là tài khoản mới.',
    v_count, v_email;
end $$;
