-- =============================================================================
-- XÓA SẠCH TOÀN BỘ dữ liệu kinh doanh của MỌI tài khoản. KHÔNG THỂ HOÀN TÁC.
--
-- Dùng khi nào: trước khi chạy migration đa seller (20261125000000_multi_tenant_foundation.sql
-- dừng lại nếu các bảng kinh doanh còn dữ liệu), hoặc khi muốn làm lại dữ liệu demo từ đầu.
-- Script chạy được cả TRƯỚC và SAU migration đa seller (bảng nào không tồn tại thì bỏ qua).
--
-- Cách dùng: Supabase Dashboard → SQL Editor → dán file này → đổi dòng
--   v_confirm text := 'KHONG';
-- thành
--   v_confirm text := 'XOA HET';
-- → Run. Để nguyên thì script không xóa gì cả.
--
-- -----------------------------------------------------------------------------
-- BẢNG BỊ XÓA HẾT DỮ LIỆU (mọi tài khoản / mọi shop):
--   inventory_movements       lịch sử biến động kho
--   order_status_events       lịch sử trạng thái đơn
--   order_items, orders       đơn hàng
--   customers                 khách hàng seller đã lưu
--   purchase_receipt_items,
--   purchase_receipts         phiếu nhập kho
--   products                  sản phẩm
--   product_trash             thùng rác sản phẩm
--   product_imports           lịch sử import Excel
--   product_sku_counters,
--   product_sku_free_numbers,
--   order_code_counters,
--   purchase_receipt_counters bộ đếm mã SKU / mã đơn / mã phiếu (bắt đầu lại từ 001)
--
-- KHÔNG BỊ XÓA: tài khoản (auth.users), profiles, sellers, danh mục, giấy tờ hồ sơ, audit_logs,
-- nhật ký thông báo (activity_logs).
--
-- STORAGE — SQL KHÔNG xóa được file, phải xóa tay:
--   Dashboard → Storage →
--     bucket "product-images"   → chọn tất cả thư mục → Delete   (ảnh sản phẩm)
--     bucket "product-imports"  → chọn tất cả thư mục → Delete   (file Excel gốc)
--   KHÔNG xóa bucket "seller-documents" (giấy tờ hồ sơ của seller).
-- =============================================================================

do $$
declare
  v_confirm text := 'KHONG';
  v_table   text;
  v_count   bigint;
  v_total   bigint := 0;
begin
  if v_confirm <> 'XOA HET' then
    raise exception 'Chưa xác nhận: đổi v_confirm thành ''XOA HET'' để xóa. Chưa xóa gì.';
  end if;

  -- Thứ tự: bảng con trước, bảng cha sau (khóa ngoại).
  foreach v_table in array array[
    'inventory_movements',
    'order_status_events',
    'order_items',
    'orders',
    'customers',
    'purchase_receipt_items',
    'purchase_receipts',
    'products',
    'product_trash',
    'product_imports',
    'product_sku_counters',
    'product_sku_free_numbers',
    'order_code_counters',
    'purchase_receipt_counters'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    execute format('delete from public.%I', v_table);
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
    raise notice 'Đã xóa % dòng trong %', v_count, v_table;
  end loop;

  raise notice 'Xong: đã xóa tổng cộng % dòng. Nhớ xóa file trong Storage (product-images, product-imports).',
    v_total;
end $$;
