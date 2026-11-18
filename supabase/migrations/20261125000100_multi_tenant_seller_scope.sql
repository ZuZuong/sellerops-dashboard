-- =============================================================================
-- Đa seller (2/3): dữ liệu kinh doanh gắn theo shop (seller_id) + RLS.
--
--  * user_id → seller_id (tham chiếu sellers.id) trên mọi bảng kinh doanh. Bảng con
--    (order_items, purchase_receipt_items) thuộc shop qua bảng cha.
--  * products.category (chữ) → products.category_id: khóa ngoại kép (seller_id, category_id) bảo
--    đảm sản phẩm chỉ trỏ tới danh mục của CHÍNH shop. Bỏ product_categories và cờ
--    category_missing (khóa ngoại không cho tồn tại sản phẩm trỏ tới danh mục đã xóa).
--  * RLS: seller đọc / ghi dữ liệu của shop mình CHỈ KHI shop `approved` và tài khoản không khóa
--    (current_approved_seller_id); admin CHỈ ĐỌC; draft / pending / rejected / suspended không
--    thấy gì.
--  * activity_logs (chuông thông báo) vẫn theo user_id: đó là nhật ký cá nhân của người dùng.
--
-- Migration 1/3 đã bảo đảm các bảng kinh doanh đang rỗng.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bỏ danh mục kiểu cũ (product_categories + products.category / category_missing)
-- -----------------------------------------------------------------------------
drop trigger if exists products_check_category on public.products;
drop function if exists public.check_product_category();
drop function if exists public.handle_new_user_categories();
drop function if exists public.seed_default_product_categories(uuid);
drop function if exists public.get_product_category_overview();
drop function if exists public.create_product_category(text);
drop function if exists public.rename_product_category(uuid, text);
drop function if exists public.delete_product_category(uuid);
drop table public.product_categories;

-- Không còn dùng ở client (xóa sản phẩm đi qua thùng rác).
drop function if exists public.delete_product(uuid);

alter table public.products
  drop column category_missing,
  drop column category;

-- -----------------------------------------------------------------------------
-- 2. Bộ đếm (dữ liệu dẫn xuất, an toàn khi xóa vì chưa có chứng từ nào)
-- -----------------------------------------------------------------------------
truncate public.order_code_counters, public.purchase_receipt_counters,
  public.product_sku_counters, public.product_sku_free_numbers;

alter table public.order_code_counters drop column user_id;
alter table public.order_code_counters
  add column seller_id uuid primary key references public.sellers (id) on delete cascade;

alter table public.purchase_receipt_counters drop column user_id;
alter table public.purchase_receipt_counters
  add column seller_id uuid primary key references public.sellers (id) on delete cascade;

alter table public.product_sku_counters drop column user_id;
alter table public.product_sku_counters
  add column seller_id uuid primary key references public.sellers (id) on delete cascade;

alter table public.product_sku_free_numbers drop column user_id;
alter table public.product_sku_free_numbers
  add column seller_id uuid not null references public.sellers (id) on delete cascade,
  add primary key (seller_id, value);

-- -----------------------------------------------------------------------------
-- 3. Bảng kinh doanh: user_id → seller_id
--    Xóa policy cũ trước (đang tham chiếu user_id), rồi đổi cột; index / unique / CHECK phụ thuộc
--    user_id bị xóa theo (cascade) và được tạo lại bên dưới.
-- -----------------------------------------------------------------------------
drop policy if exists "products: select own" on public.products;
drop policy if exists "products: insert own" on public.products;
drop policy if exists "products: update own" on public.products;
drop policy if exists "products: delete own" on public.products;
drop policy if exists "orders: select own" on public.orders;
drop policy if exists "orders: insert own" on public.orders;
drop policy if exists "orders: update own" on public.orders;
drop policy if exists "order_items: select own" on public.order_items;
drop policy if exists "order_items: insert into own pending order" on public.order_items;
drop policy if exists "order_items: update in own pending order" on public.order_items;
drop policy if exists "order_items: delete from own pending order" on public.order_items;
drop policy if exists "inventory_movements: select own" on public.inventory_movements;
drop policy if exists "order_status_events: select own" on public.order_status_events;
drop policy if exists "purchase_receipts: select own" on public.purchase_receipts;
drop policy if exists "purchase_receipt_items: select own" on public.purchase_receipt_items;
drop policy if exists "product_imports: select own" on public.product_imports;
drop policy if exists "product_trash: select own" on public.product_trash;
drop policy if exists "customers: select own" on public.customers;
drop policy if exists "customers: delete own" on public.customers;

-- products (client insert / update trực tiếp → mặc định là shop đã duyệt của người gọi)
alter table public.products drop column user_id cascade;
alter table public.products
  add column seller_id uuid not null default public.current_approved_seller_id()
    references public.sellers (id) on delete cascade,
  add column category_id uuid,
  add constraint products_category_same_seller_fkey
    foreign key (seller_id, category_id) references public.categories (seller_id, id),
  add constraint products_seller_sku_key unique (seller_id, sku),
  add constraint products_image_paths_owned
    check (public.paths_owned_by(array_append(image_paths, hero_image_path), seller_id));

create index products_seller_name_idx on public.products (seller_id, name);
create index products_seller_created_idx on public.products (seller_id, created_at desc);
create index products_seller_low_stock_idx on public.products (seller_id) where is_low_stock;
create index products_seller_normalized_name_idx
  on public.products (seller_id, public.normalize_product_name(name));
create index products_category_idx on public.products (category_id) where category_id is not null;

-- orders
alter table public.orders drop column user_id cascade;
alter table public.orders
  add column seller_id uuid not null references public.sellers (id) on delete cascade,
  add constraint orders_seller_code_key unique (seller_id, code);

create index orders_seller_status_created_idx on public.orders (seller_id, status, created_at desc);
create index orders_seller_created_idx on public.orders (seller_id, created_at desc);

-- order_status_events
alter table public.order_status_events drop column user_id cascade;
alter table public.order_status_events
  add column seller_id uuid not null references public.sellers (id) on delete cascade;
create index order_status_events_seller_idx on public.order_status_events (seller_id);

-- inventory_movements
alter table public.inventory_movements drop column user_id cascade;
alter table public.inventory_movements
  add column seller_id uuid not null references public.sellers (id) on delete cascade;
create index inventory_movements_seller_created_idx
  on public.inventory_movements (seller_id, created_at desc);
create index inventory_movements_seller_product_created_idx
  on public.inventory_movements (seller_id, product_id, created_at);
-- Khóa ngoại tới đơn / phiếu nhập: index để join và kiểm tra khóa ngoại không quét cả bảng.
create index inventory_movements_order_idx on public.inventory_movements (order_id)
  where order_id is not null;
create index inventory_movements_receipt_idx on public.inventory_movements (receipt_id)
  where receipt_id is not null;

-- product_trash
alter table public.product_trash drop column user_id cascade;
alter table public.product_trash
  add column seller_id uuid not null references public.sellers (id) on delete cascade;
create index product_trash_seller_deleted_idx on public.product_trash (seller_id, deleted_at desc);
create index product_trash_seller_purge_idx on public.product_trash (seller_id, purge_at);

-- product_imports (file nằm trong thư mục {seller_id}/ của bucket product-imports)
alter table public.product_imports drop column user_id cascade;
alter table public.product_imports
  add column seller_id uuid not null references public.sellers (id) on delete cascade,
  add constraint product_imports_path_in_seller_folder
    check (starts_with(file_path, seller_id::text || '/'));
create index product_imports_seller_created_idx on public.product_imports (seller_id, created_at desc);

-- purchase_receipts
alter table public.purchase_receipts drop column user_id cascade;
alter table public.purchase_receipts
  add column seller_id uuid not null references public.sellers (id) on delete cascade,
  add constraint purchase_receipts_seller_code_key unique (seller_id, code);
create index purchase_receipts_seller_created_idx
  on public.purchase_receipts (seller_id, created_at desc);
create index purchase_receipts_seller_status_idx
  on public.purchase_receipts (seller_id, status, created_at desc);

-- customers = khách do SELLER lưu lại khi tạo đơn (danh bạ của shop), KHÔNG phải tài khoản
-- người mua (role `customer` trong profiles).
alter table public.customers drop column user_id cascade;
alter table public.customers
  add column seller_id uuid not null references public.sellers (id) on delete cascade,
  add constraint customers_seller_phone_key unique (seller_id, phone);
create index customers_seller_recent_idx
  on public.customers (seller_id, last_order_at desc nulls last);

-- -----------------------------------------------------------------------------
-- 4. Trigger theo seller_id
-- -----------------------------------------------------------------------------

-- Sản phẩm chưa có danh mục thì không đăng bán được (thay cho cờ category_missing cũ).
create function public.enforce_product_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is null then
    new.is_active := false;
  end if;
  return new;
end $$;

create trigger products_enforce_category
  before insert or update of category_id, is_active on public.products
  for each row execute function public.enforce_product_category();

create or replace function public.log_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.inventory_movements (seller_id, product_id, delta, reason, unit_cost)
    values (new.seller_id, new.id, new.stock, 'initial_stock', new.cost_price);
  end if;
  return new;
end $$;

-- Chốt unit_price theo giá hiện tại; sản phẩm phải cùng shop với đơn và đang bán.
create or replace function public.set_order_item_unit_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price numeric(12, 0);
begin
  select p.price into v_price
  from public.products p
  join public.orders o on o.id = new.order_id
  where p.id = new.product_id
    and p.seller_id = o.seller_id
    and p.is_active;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using detail = new.product_id::text;
  end if;

  new.unit_price := v_price;
  return new;
end $$;

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_events (order_id, seller_id, status)
    values (new.id, new.seller_id, new.status);
  end if;
  return null;
end $$;

-- SKU theo từng shop: ưu tiên số đã trả lại (nhỏ nhất), không có thì lấy số mới từ bộ đếm.
create or replace function public.assign_product_sku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  -- SKU có sẵn chỉ đến từ restore_products (client không ghi được cột sku).
  if coalesce(new.sku, '') <> '' then
    return new;
  end if;

  delete from public.product_sku_free_numbers f
  where f.seller_id = new.seller_id
    and f.value = (
      select min(x.value) from public.product_sku_free_numbers x where x.seller_id = new.seller_id
    )
  returning f.value into v_seq;

  if v_seq is null then
    insert into public.product_sku_counters as c (seller_id, last_value)
    values (new.seller_id, 1)
    on conflict (seller_id) do update set last_value = c.last_value + 1
    returning c.last_value into v_seq;
  end if;

  new.sku := 'DN-' || public.sku_name_part(new.name) || '-'
    || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0');
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 5. RLS
--    Seller: shop của mình VÀ đã duyệt (current_approved_seller_id null khi chưa duyệt / bị khóa).
--    Admin: chỉ SELECT. Hàm bọc trong (select …) để Postgres tính một lần mỗi câu truy vấn.
-- -----------------------------------------------------------------------------

-- products: client thêm / sửa trực tiếp (form sản phẩm); xóa qua thùng rác (RPC).
create policy "products: seller read" on public.products
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "products: seller insert" on public.products
  for insert to authenticated with check (seller_id = (select public.current_approved_seller_id()));
create policy "products: seller update" on public.products
  for update to authenticated
  using (seller_id = (select public.current_approved_seller_id()))
  with check (seller_id = (select public.current_approved_seller_id()));
create policy "products: admin read" on public.products
  for select to authenticated using ((select public.is_admin()));

grant insert (category_id), update (category_id) on public.products to authenticated;

-- orders / order_items: chỉ đọc; tạo đơn và chuyển trạng thái qua RPC.
create policy "orders: seller read" on public.orders
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "orders: admin read" on public.orders
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.orders from authenticated;

create policy "order_items: seller read" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.seller_id = (select public.current_approved_seller_id())
    )
  );
create policy "order_items: admin read" on public.order_items
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.order_items from authenticated;

create policy "order_status_events: seller read" on public.order_status_events
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "order_status_events: admin read" on public.order_status_events
  for select to authenticated using ((select public.is_admin()));

create policy "inventory_movements: seller read" on public.inventory_movements
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "inventory_movements: admin read" on public.inventory_movements
  for select to authenticated using ((select public.is_admin()));

create policy "purchase_receipts: seller read" on public.purchase_receipts
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "purchase_receipts: admin read" on public.purchase_receipts
  for select to authenticated using ((select public.is_admin()));

create policy "purchase_receipt_items: seller read" on public.purchase_receipt_items
  for select to authenticated using (
    exists (
      select 1 from public.purchase_receipts r
      where r.id = receipt_id and r.seller_id = (select public.current_approved_seller_id())
    )
  );
create policy "purchase_receipt_items: admin read" on public.purchase_receipt_items
  for select to authenticated using ((select public.is_admin()));

create policy "product_imports: seller read" on public.product_imports
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "product_imports: admin read" on public.product_imports
  for select to authenticated using ((select public.is_admin()));

create policy "product_trash: seller read" on public.product_trash
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "product_trash: admin read" on public.product_trash
  for select to authenticated using ((select public.is_admin()));

create policy "customers: seller read" on public.customers
  for select to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "customers: seller delete" on public.customers
  for delete to authenticated using (seller_id = (select public.current_approved_seller_id()));
create policy "customers: admin read" on public.customers
  for select to authenticated using ((select public.is_admin()));
