-- =============================================================================
-- Kiểm tra RLS / quyền đa seller. Chạy trong Supabase Dashboard → SQL Editor (dán cả file → Run).
--
--  * Toàn bộ chạy trong MỘT transaction và ROLLBACK ở cuối: không để lại user / dữ liệu test.
--  * Giả lập người dùng bằng `role = authenticated` + `request.jwt.claims` (giống request thật từ
--    PostgREST), nên RLS, quyền theo cột và kiểm tra trong RPC đều được áp dụng thật.
--  * Kiểm tra nào sai → script dừng với lỗi "FAIL [mã] …". Chạy hết → dòng cuối
--    "ALL RLS CHECKS PASSED".
--  * Email dạng *@rls-check.test chỉ là dữ liệu giả trong transaction (không gửi thư).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Dữ liệu giả (chạy với quyền postgres)
-- -----------------------------------------------------------------------------
create function pg_temp.claims(p_uid uuid)
returns text
language sql
immutable
as $$ select json_build_object('sub', p_uid, 'role', 'authenticated')::text $$;

-- Người dùng: A, B = seller đã duyệt · C = seller chờ duyệt · D = customer · E = admin · F = seller draft
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  x.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  x.email, '', now(), '{}', '{}', now(), now()
from (values
  ('a0000000-0000-4000-8000-00000000000a', 'seller-a@rls-check.test'),
  ('b0000000-0000-4000-8000-00000000000b', 'seller-b@rls-check.test'),
  ('c0000000-0000-4000-8000-00000000000c', 'seller-pending@rls-check.test'),
  ('d0000000-0000-4000-8000-00000000000d', 'customer@rls-check.test'),
  ('e0000000-0000-4000-8000-00000000000e', 'admin@rls-check.test'),
  ('f0000000-0000-4000-8000-00000000000f', 'seller-draft@rls-check.test')
) as x(id, email);

update public.profiles set role = 'seller'
where id in (
  'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b',
  'c0000000-0000-4000-8000-00000000000c', 'f0000000-0000-4000-8000-00000000000f'
);
update public.profiles set role = 'admin' where id = 'e0000000-0000-4000-8000-00000000000e';

insert into public.sellers (
  id, owner_id, status, shop_name, submitted_at, terms_version, terms_accepted_at, reviewed_at
)
values
  ('5a000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a',
   'approved', 'Shop A', now(), 'test', now(), now()),
  ('5b000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b',
   'approved', 'Shop B', now(), 'test', now(), now()),
  ('5c000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000c',
   'pending', 'Shop C', now(), 'test', now(), null);
insert into public.sellers (id, owner_id, status)
values ('5f000000-0000-4000-8000-00000000000f', 'f0000000-0000-4000-8000-00000000000f', 'draft');

insert into public.categories (id, seller_id, name, slug)
values
  ('ca000000-0000-4000-8000-00000000000a', '5a000000-0000-4000-8000-00000000000a', 'Áo A', 'ao-a'),
  ('cb000000-0000-4000-8000-00000000000b', '5b000000-0000-4000-8000-00000000000b', 'Áo B', 'ao-b');

-- Shop A: 2 sản phẩm (tồn 10 + 5) · Shop B: 1 sản phẩm (tồn 7)
insert into public.products (seller_id, category_id, name, price, cost_price, stock, is_active)
values
  ('5a000000-0000-4000-8000-00000000000a', 'ca000000-0000-4000-8000-00000000000a', 'SP A1', 100000, 60000, 10, true),
  ('5a000000-0000-4000-8000-00000000000a', 'ca000000-0000-4000-8000-00000000000a', 'SP A2', 200000, 90000, 5, true),
  ('5b000000-0000-4000-8000-00000000000b', 'cb000000-0000-4000-8000-00000000000b', 'SP B1', 300000, 100000, 7, true);

-- -----------------------------------------------------------------------------
-- 1. Cách ly giữa các shop
-- -----------------------------------------------------------------------------
do $$
declare
  v_own   int;
  v_other int;
  v_rows  int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
  perform set_config('role', 'authenticated', true);

  select count(*) into v_own from public.products;
  select count(*) into v_other from public.products
  where seller_id = '5b000000-0000-4000-8000-00000000000b';
  update public.products set price = 1
  where seller_id = '5b000000-0000-4000-8000-00000000000b';
  get diagnostics v_rows = row_count;

  perform set_config('role', 'none', true);
  if v_own <> 2 then raise exception 'FAIL [1.1] seller A phải thấy đúng 2 sản phẩm của mình, thấy %', v_own; end if;
  if v_other <> 0 then raise exception 'FAIL [1.2] seller A đọc được % sản phẩm của seller B', v_other; end if;
  if v_rows <> 0 then raise exception 'FAIL [1.3] seller A sửa được % sản phẩm của seller B', v_rows; end if;
  raise notice 'PASS [1] seller A không đọc / sửa được dữ liệu seller B';
end $$;

-- Sản phẩm không được trỏ tới danh mục của shop khác (khóa ngoại kép).
do $$
begin
  begin
    perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
    perform set_config('role', 'authenticated', true);
    insert into public.products (name, category_id, price)
    values ('SP lấn sân', 'cb000000-0000-4000-8000-00000000000b', 1000);
    perform set_config('role', 'none', true);
    raise exception 'FAIL [1.4] seller A gắn được sản phẩm vào danh mục của seller B';
  exception when foreign_key_violation then
    raise notice 'PASS [1.4] không gắn được sản phẩm vào danh mục shop khác';
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Shop chưa duyệt không đọc / ghi được dữ liệu kinh doanh
-- -----------------------------------------------------------------------------
do $$
declare
  v_count int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('c0000000-0000-4000-8000-00000000000c'), true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.products;
  perform set_config('role', 'none', true);
  if v_count <> 0 then raise exception 'FAIL [2.1] seller pending đọc được % sản phẩm', v_count; end if;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('c0000000-0000-4000-8000-00000000000c'), true);
    perform set_config('role', 'authenticated', true);
    insert into public.products (name, price) values ('SP chờ duyệt', 1000);
    perform set_config('role', 'none', true);
    raise exception 'FAIL [2.2] seller pending thêm được sản phẩm';
  exception when not_null_violation or insufficient_privilege or check_violation then
    null; -- seller_id mặc định null (chưa duyệt) / RLS chặn
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('c0000000-0000-4000-8000-00000000000c'), true);
    perform set_config('role', 'authenticated', true);
    perform public.create_order('Khách', '', '[{"product_id":"00000000-0000-4000-8000-000000000000","quantity":1}]');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [2.3] seller pending tạo được đơn hàng';
  exception when raise_exception then
    if sqlerrm <> 'SELLER_NOT_APPROVED' then raise; end if;
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('c0000000-0000-4000-8000-00000000000c'), true);
    perform set_config('role', 'authenticated', true);
    insert into public.seller_documents (seller_id, kind, storage_path, file_name, mime_type, file_size)
    values ('5c000000-0000-4000-8000-00000000000c', 'business_license',
            'c0000000-0000-4000-8000-00000000000c/business_license/1-gp.pdf', 'gp.pdf', 'application/pdf', 100);
    perform set_config('role', 'none', true);
    raise exception 'FAIL [2.4] seller pending thêm được giấy tờ (hồ sơ đã khóa)';
  exception when insufficient_privilege then
    null;
  end;

  raise notice 'PASS [2] seller pending không đọc / ghi được dữ liệu kinh doanh, không sửa được hồ sơ';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Không tự nâng quyền
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    perform set_config('request.jwt.claims', pg_temp.claims('d0000000-0000-4000-8000-00000000000d'), true);
    perform set_config('role', 'authenticated', true);
    update public.profiles set role = 'admin' where id = 'd0000000-0000-4000-8000-00000000000d';
    perform set_config('role', 'none', true);
    raise exception 'FAIL [3.1] user tự đổi được role';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
    perform set_config('role', 'authenticated', true);
    update public.profiles set is_locked = false where id = 'a0000000-0000-4000-8000-00000000000a';
    perform set_config('role', 'none', true);
    raise exception 'FAIL [3.2] user tự sửa được is_locked';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('c0000000-0000-4000-8000-00000000000c'), true);
    perform set_config('role', 'authenticated', true);
    update public.sellers set status = 'approved' where id = '5c000000-0000-4000-8000-00000000000c';
    perform set_config('role', 'none', true);
    raise exception 'FAIL [3.3] seller tự duyệt được shop';
  exception when insufficient_privilege then
    null;
  end;

  raise notice 'PASS [3] không tự đổi được role / is_locked / trạng thái shop';
end $$;

-- -----------------------------------------------------------------------------
-- 4. Customer không đọc được sellers
-- -----------------------------------------------------------------------------
do $$
declare
  v_count int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('d0000000-0000-4000-8000-00000000000d'), true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.sellers;
  perform set_config('role', 'none', true);
  if v_count <> 0 then raise exception 'FAIL [4] customer đọc được % shop', v_count; end if;
  raise notice 'PASS [4] customer không đọc được sellers';
end $$;

-- -----------------------------------------------------------------------------
-- 5. Admin: đọc được mọi shop, KHÔNG ghi trực tiếp dữ liệu kinh doanh
-- -----------------------------------------------------------------------------
do $$
declare
  v_count int;
  v_rows  int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.products;
  update public.products set price = 1;
  get diagnostics v_rows = row_count;
  perform set_config('role', 'none', true);

  if v_count <> 3 then raise exception 'FAIL [5.1] admin phải đọc được 3 sản phẩm của mọi shop, thấy %', v_count; end if;
  if v_rows <> 0 then raise exception 'FAIL [5.2] admin sửa trực tiếp được % sản phẩm', v_rows; end if;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
    perform set_config('role', 'authenticated', true);
    insert into public.products (name, price) values ('SP của admin', 1000);
    perform set_config('role', 'none', true);
    raise exception 'FAIL [5.3] admin thêm trực tiếp được sản phẩm';
  exception when not_null_violation or insufficient_privilege or check_violation then
    null;
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
    perform set_config('role', 'authenticated', true);
    perform public.adjust_stock(
      (select id from public.products where seller_id = '5a000000-0000-4000-8000-00000000000a' limit 1), 5, 'admin');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [5.4] admin điều chỉnh được kho của seller';
  exception when raise_exception then
    if sqlerrm <> 'SELLER_NOT_FOUND' then raise; end if;
  end;

  raise notice 'PASS [5] admin chỉ đọc, không ghi được dữ liệu kinh doanh';
end $$;

-- -----------------------------------------------------------------------------
-- 6. Báo cáo theo p_seller_id
-- -----------------------------------------------------------------------------
do $$
declare
  v_own   int;
  v_admin int;
begin
  -- Seller A bỏ trống p_seller_id → shop của mình (2 sản phẩm đang bán).
  perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
  perform set_config('role', 'authenticated', true);
  select product_count into v_own from public.get_inventory_summary();
  perform set_config('role', 'none', true);
  if v_own <> 2 then raise exception 'FAIL [6.1] báo cáo của seller A phải có 2 sản phẩm, có %', v_own; end if;

  -- Seller A truyền id shop B → FORBIDDEN.
  begin
    perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
    perform set_config('role', 'authenticated', true);
    perform public.get_inventory_summary('5b000000-0000-4000-8000-00000000000b');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [6.2] seller A xem được báo cáo của seller B';
  exception when raise_exception then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;

  -- Admin truyền id shop A → chỉ số liệu của A (2), không cộng dồn mọi shop (3).
  perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
  perform set_config('role', 'authenticated', true);
  select product_count into v_admin
  from public.get_inventory_summary('5a000000-0000-4000-8000-00000000000a');
  perform set_config('role', 'none', true);
  if v_admin <> 2 then raise exception 'FAIL [6.3] admin xem shop A phải thấy 2 sản phẩm, thấy %', v_admin; end if;

  raise notice 'PASS [6] báo cáo: seller chỉ xem shop mình; admin xem đúng shop được chọn';
end $$;

-- -----------------------------------------------------------------------------
-- 7. RPC của admin: seller / customer không gọi được
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
    perform set_config('role', 'authenticated', true);
    perform public.review_seller('5c000000-0000-4000-8000-00000000000c', 'approved', null);
    perform set_config('role', 'none', true);
    raise exception 'FAIL [7.1] seller duyệt được hồ sơ';
  exception when raise_exception then
    if sqlerrm <> 'NOT_ADMIN' then raise; end if;
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('d0000000-0000-4000-8000-00000000000d'), true);
    perform set_config('role', 'authenticated', true);
    perform * from public.admin_list_accounts();
    perform set_config('role', 'none', true);
    raise exception 'FAIL [7.2] customer gọi được admin_list_accounts';
  exception when raise_exception then
    if sqlerrm <> 'NOT_ADMIN' then raise; end if;
  end;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
    perform set_config('role', 'authenticated', true);
    perform public.set_account_locked('b0000000-0000-4000-8000-00000000000b', true, 'test');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [7.3] seller khóa được tài khoản khác';
  exception when raise_exception then
    if sqlerrm <> 'NOT_ADMIN' then raise; end if;
  end;

  raise notice 'PASS [7] seller / customer không gọi được RPC của admin';
end $$;

-- -----------------------------------------------------------------------------
-- 8. Admin duyệt hồ sơ → ghi audit_logs; seller không đọc được audit_logs
-- -----------------------------------------------------------------------------
do $$
declare
  v_logs   int;
  v_status public.seller_status;
  v_seen   int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
  perform set_config('role', 'authenticated', true);
  perform public.review_seller('5c000000-0000-4000-8000-00000000000c', 'rejected', 'Thiếu giấy phép rõ nét');
  select count(*) into v_logs from public.audit_logs
  where target_id = '5c000000-0000-4000-8000-00000000000c' and action = 'seller.rejected';
  perform set_config('role', 'none', true);

  select status into v_status from public.sellers where id = '5c000000-0000-4000-8000-00000000000c';
  if v_status <> 'rejected' then raise exception 'FAIL [8.1] hồ sơ phải ở trạng thái rejected, đang %', v_status; end if;
  if v_logs <> 1 then raise exception 'FAIL [8.2] duyệt hồ sơ phải ghi 1 dòng audit_logs, có %', v_logs; end if;

  -- Từ chối bắt buộc có lý do.
  begin
    update public.sellers set status = 'pending', submitted_at = now()
    where id = '5c000000-0000-4000-8000-00000000000c';
    perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
    perform set_config('role', 'authenticated', true);
    perform public.review_seller('5c000000-0000-4000-8000-00000000000c', 'rejected', '   ');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [8.3] từ chối được hồ sơ mà không có lý do';
  exception when raise_exception then
    if sqlerrm <> 'REASON_REQUIRED' then raise; end if;
  end;

  perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_seen from public.audit_logs;
  perform set_config('role', 'none', true);
  if v_seen <> 0 then raise exception 'FAIL [8.4] seller đọc được % dòng audit_logs', v_seen; end if;

  raise notice 'PASS [8] duyệt hồ sơ ghi audit_logs; chỉ admin đọc audit_logs';
end $$;

-- -----------------------------------------------------------------------------
-- 9. State machine trạng thái shop (áp dụng cả khi sửa bằng SQL trực tiếp)
-- -----------------------------------------------------------------------------
do $$
begin
  begin
    update public.sellers set status = 'draft' where id = '5a000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL [9] chuyển được approved → draft';
  exception when raise_exception then
    if sqlerrm <> 'INVALID_SELLER_TRANSITION' then raise; end if;
  end;
  raise notice 'PASS [9] state machine chặn chuyển trạng thái sai';
end $$;

-- -----------------------------------------------------------------------------
-- 10. Tài khoản bị khóa mất quyền ngay; admin không khóa được chính mình
-- -----------------------------------------------------------------------------
do $$
declare
  v_count int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
  perform set_config('role', 'authenticated', true);
  perform public.set_account_locked('a0000000-0000-4000-8000-00000000000a', true, 'Vi phạm nội quy');
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', pg_temp.claims('a0000000-0000-4000-8000-00000000000a'), true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.products;
  perform set_config('role', 'none', true);
  if v_count <> 0 then raise exception 'FAIL [10.1] seller bị khóa vẫn đọc được % sản phẩm', v_count; end if;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('e0000000-0000-4000-8000-00000000000e'), true);
    perform set_config('role', 'authenticated', true);
    perform public.set_account_locked('e0000000-0000-4000-8000-00000000000e', true, 'test');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [10.2] admin tự khóa được chính mình';
  exception when raise_exception then
    if sqlerrm <> 'CANNOT_LOCK_SELF' then raise; end if;
  end;

  raise notice 'PASS [10] khóa tài khoản có hiệu lực ngay; không tự khóa được mình';
end $$;

-- -----------------------------------------------------------------------------
-- 11. Hồ sơ nháp: seller draft tạo được danh mục, không gửi được hồ sơ thiếu thông tin
-- -----------------------------------------------------------------------------
do $$
declare
  v_count int;
begin
  perform set_config('request.jwt.claims', pg_temp.claims('f0000000-0000-4000-8000-00000000000f'), true);
  perform set_config('role', 'authenticated', true);
  perform public.create_category('Giày dép');
  select count(*) into v_count from public.categories;
  perform set_config('role', 'none', true);
  if v_count <> 1 then raise exception 'FAIL [11.1] seller draft phải thấy 1 danh mục của mình, thấy %', v_count; end if;

  begin
    perform set_config('request.jwt.claims', pg_temp.claims('f0000000-0000-4000-8000-00000000000f'), true);
    perform set_config('role', 'authenticated', true);
    perform public.submit_seller_application('v1');
    perform set_config('role', 'none', true);
    raise exception 'FAIL [11.2] gửi được hồ sơ thiếu thông tin';
  exception when raise_exception then
    if sqlerrm <> 'APPLICATION_INCOMPLETE' then raise; end if;
  end;

  raise notice 'PASS [11] hồ sơ nháp: tạo danh mục được, gửi hồ sơ thiếu bị chặn';
end $$;

select 'ALL RLS CHECKS PASSED' as result;

rollback;
