-- =============================================================================
-- SellerOps – Product Management
--   * is_low_stock: cột sinh tự động để lọc "sắp hết hàng" phía server (PostgREST không so sánh
--     hai cột với nhau được).
--   * get_product_categories: danh sách danh mục cho bộ lọc / autocomplete.
--   * delete_product: xóa cứng atomic; từ chối nếu sản phẩm đã nằm trong đơn hàng.
-- Mã lỗi: PRODUCT_NOT_FOUND, PRODUCT_IN_ORDERS
-- =============================================================================

alter table public.products
  add column is_low_stock boolean generated always as (stock <= low_stock_threshold) stored;

create index products_user_created_idx on public.products (user_id, created_at desc);
create index products_user_low_stock_idx on public.products (user_id) where is_low_stock;

-- Danh mục (không trùng, đã sắp xếp) của user hiện tại. RLS áp dụng vì SECURITY INVOKER.
create function public.get_product_categories()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct trim(p.category)
  from public.products p
  where p.category is not null and length(trim(p.category)) > 0
  order by 1;
$$;

-- Xóa cứng sản phẩm chưa từng bán. Sản phẩm đã có trong đơn chỉ được ngừng bán (is_active = false)
-- để giữ lịch sử đơn hàng. Lịch sử kho (inventory_movements) của sản phẩm chưa từng bán chỉ gồm
-- tồn kho ban đầu / điều chỉnh tay nên được xóa cùng trong một transaction.
create function public.delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- FOR UPDATE: chặn tranh chấp với một đơn đang thêm sản phẩm này cùng lúc
  -- (insert order_items lấy KEY SHARE lock trên dòng products qua khóa ngoại).
  perform 1 from public.products
  where id = p_product_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if exists (select 1 from public.order_items where product_id = p_product_id) then
    raise exception 'PRODUCT_IN_ORDERS';
  end if;

  delete from public.inventory_movements where product_id = p_product_id;
  delete from public.products where id = p_product_id;
end $$;

revoke execute on function public.get_product_categories() from public, anon;
revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.get_product_categories() to authenticated;
grant execute on function public.delete_product(uuid) to authenticated;
