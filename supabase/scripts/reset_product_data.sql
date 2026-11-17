-- =============================================================================
-- XÓA SẠCH dữ liệu sản phẩm của MỘT tài khoản để nhập lại từ đầu. KHÔNG THỂ HOÀN TÁC.
--
-- Cách dùng: Supabase Dashboard → SQL Editor → dán file này → thay email ở dòng
--   v_email text := 'YOUR_EMAIL@example.com';
-- → Run. Để nguyên email mẫu thì script không xóa gì cả.
--
-- Sản phẩm đã nằm trong đơn hàng / phiếu nhập không thể xóa riêng (khóa ngoại giữ chứng từ),
-- nên script xóa luôn ĐƠN HÀNG và PHIẾU NHẬP của tài khoản này. Bộ đếm SKU / mã đơn / mã phiếu
-- được đặt lại → sản phẩm mới bắt đầu từ ...-001.
--
-- Ảnh sản phẩm và file Excel gốc nằm trong Storage, SQL không xóa được:
-- Dashboard → Storage → bucket "product-images" và "product-imports" → mở thư mục mang
-- user id được in ra ở cuối script → chọn tất cả → Delete.
-- =============================================================================

do $$
declare
  v_email   text := 'YOUR_EMAIL@example.com';
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception 'Không tìm thấy tài khoản %, chưa xóa gì.', v_email;
  end if;

  -- Thứ tự: bảng con trước, bảng cha sau.
  delete from public.inventory_movements    where user_id = v_user_id;
  delete from public.order_status_events    where user_id = v_user_id;
  delete from public.order_items
    where order_id in (select id from public.orders where user_id = v_user_id);
  delete from public.orders                 where user_id = v_user_id;
  delete from public.purchase_receipt_items
    where receipt_id in (select id from public.purchase_receipts where user_id = v_user_id);
  delete from public.purchase_receipts      where user_id = v_user_id;
  delete from public.products               where user_id = v_user_id;
  delete from public.product_trash          where user_id = v_user_id;
  delete from public.product_imports        where user_id = v_user_id;
  delete from public.product_sku_counters   where user_id = v_user_id;
  delete from public.product_sku_free_numbers where user_id = v_user_id;
  delete from public.order_code_counters    where user_id = v_user_id;
  delete from public.purchase_receipt_counters where user_id = v_user_id;

  raise notice 'Đã xóa dữ liệu sản phẩm của % (user id: %). Nhớ dọn Storage theo hướng dẫn.',
    v_email, v_user_id;
end $$;
