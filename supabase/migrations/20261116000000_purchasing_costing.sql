-- =============================================================================
-- SellerOps – Nhập hàng, giá vốn & lịch sử import
--
-- Giá vốn: BÌNH QUÂN GIA QUYỀN LIÊN HOÀN (Thông tư 200/2014/TT-BTC).
--   * products.cost_price = giá vốn bình quân hiện tại của 1 đơn vị.
--   * Nhập kho (duyệt phiếu nhập): giá vốn mới = (tồn × giá vốn + SL nhập × đơn giá nhập) / (tồn + SL nhập).
--   * Xác nhận đơn: chốt giá vốn hiện tại vào order_items.unit_cost → giá vốn hàng bán (COGS) không
--     đổi khi sau này nhập lô giá khác. Hủy đơn đã xác nhận: hoàn kho theo đúng giá vốn đã chốt.
--   * Mọi biến động kho ghi kèm unit_cost để lập báo cáo xuất nhập tồn có giá trị.
--
-- Phiếu nhập kho (theo Mẫu 01-VT): NHÁP → ĐÃ NHẬP KHO.
--   * Nháp: sửa / xóa thoải mái, chưa ảnh hưởng kho.
--   * Duyệt (post_purchase_receipt): cộng kho SL thực nhận (hàng đạt), cập nhật giá vốn, ghi
--     inventory_movements — một transaction. Phiếu đã nhập kho không sửa / xóa (chứng từ đã ghi sổ).
--   * Mỗi dòng: SL theo chứng từ, SL thực nhận (đạt), SL lỗi (KHÔNG nhập kho, chỉ ghi nhận để đối
--     chiếu / trả NCC), đơn giá nhập, tình trạng hàng.
--
-- Lịch sử import Excel: file gốc lưu ở bucket riêng tư `product-imports/<user_id>/…`, mỗi lần nhập
-- tạo một bản ghi product_imports; sản phẩm tạo ra gắn import_id để tra lại.
--
-- Mã lỗi mới: RECEIPT_NOT_FOUND, RECEIPT_NOT_DRAFT, RECEIPT_EMPTY, RECEIPT_NO_RECEIVED,
--   INVALID_SUPPLIER, INVALID_RECEIPT_ITEM, DUPLICATE_PRODUCT, PRODUCT_NOT_FOUND,
--   IMPORT_EMPTY, TOO_MANY_ROWS, INVALID_FILE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sản phẩm: đơn vị tính + giá vốn
-- -----------------------------------------------------------------------------
alter table public.products
  add column unit text not null default 'Cái'
    check (length(trim(unit)) between 1 and 20),
  add column cost_price numeric(14, 2) not null default 0
    check (cost_price >= 0);

-- Giá vốn mở đầu nhập khi tạo sản phẩm; sửa tay được (vd. khai báo giá vốn cho hàng tồn cũ),
-- còn lại tự cập nhật qua phiếu nhập kho.
grant insert (unit, cost_price), update (unit, cost_price) on public.products to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Giá vốn chốt trên dòng đơn + đơn giá trên biến động kho
-- -----------------------------------------------------------------------------
alter table public.order_items
  -- null = đơn chưa xác nhận (chưa xuất kho nên chưa có giá vốn).
  add column unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0);

-- Đơn đã xác nhận trước khi có giá vốn: lấy giá vốn hiện tại (thường là 0) để báo cáo không null.
update public.order_items i
set unit_cost = p.cost_price
from public.orders o, public.products p
where o.id = i.order_id
  and p.id = i.product_id
  and o.status in ('confirmed', 'shipping', 'delivered');

-- -----------------------------------------------------------------------------
-- 3. Phiếu nhập kho
-- -----------------------------------------------------------------------------
create type public.receipt_status as enum ('draft', 'posted');

create table public.purchase_receipts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code            text not null,
  status          public.receipt_status not null default 'draft',
  supplier_name   text not null check (length(trim(supplier_name)) between 1 and 200),
  supplier_phone  text check (supplier_phone is null or length(supplier_phone) <= 20),
  -- Số hóa đơn / chứng từ của nhà cung cấp ("Theo ... số").
  invoice_number  text check (invoice_number is null or length(invoice_number) <= 50),
  delivered_by    text check (delivered_by is null or length(delivered_by) <= 200),
  received_date   date not null,
  note            text check (note is null or length(note) <= 1000),
  total_amount    numeric(16, 0) not null default 0 check (total_amount >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  posted_at       timestamptz,
  unique (user_id, code),
  check ((status = 'posted') = (posted_at is not null))
);

create table public.purchase_receipt_items (
  id             uuid primary key default gen_random_uuid(),
  receipt_id     uuid not null references public.purchase_receipts (id) on delete cascade,
  product_id     uuid not null references public.products (id),
  ordered_qty    int not null check (ordered_qty > 0),
  received_qty   int not null check (received_qty >= 0),
  defective_qty  int not null default 0 check (defective_qty >= 0),
  unit_cost      numeric(14, 2) not null check (unit_cost >= 0),
  condition_note text check (condition_note is null or length(condition_note) <= 200),
  position       int not null default 0,
  unique (receipt_id, product_id),
  -- Thực nhận + lỗi không vượt SL theo chứng từ (phần thiếu = NCC giao thiếu).
  check (received_qty + defective_qty <= ordered_qty)
);

create index purchase_receipts_user_created_idx on public.purchase_receipts (user_id, created_at desc);
create index purchase_receipts_user_status_idx on public.purchase_receipts (user_id, status, created_at desc);
create index purchase_receipt_items_receipt_idx on public.purchase_receipt_items (receipt_id, position);
create index purchase_receipt_items_product_idx on public.purchase_receipt_items (product_id);

alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;

create policy "purchase_receipts: select own" on public.purchase_receipts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "purchase_receipt_items: select own" on public.purchase_receipt_items
  for select to authenticated using (
    exists (
      select 1 from public.purchase_receipts r
      where r.id = receipt_id and r.user_id = (select auth.uid())
    )
  );

-- Chỉ đọc trực tiếp; mọi thay đổi đi qua RPC (lưu nháp / duyệt / xóa) để luôn atomic.
revoke all on public.purchase_receipts, public.purchase_receipt_items from anon;
revoke insert, update, delete on public.purchase_receipts, public.purchase_receipt_items from authenticated;

create table public.purchase_receipt_counters (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  last_value int not null default 0 check (last_value >= 0)
);
alter table public.purchase_receipt_counters enable row level security;
revoke all on public.purchase_receipt_counters from anon, authenticated;

create function public.next_receipt_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  insert into public.purchase_receipt_counters as c (user_id, last_value)
  values (p_user_id, 1)
  on conflict (user_id) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;
  return 'PN-' || lpad(v_seq::text, greatest(6, length(v_seq::text)), '0');
end $$;

-- inventory_movements: thêm lý do nhập kho theo phiếu, đơn giá và liên kết phiếu.
alter table public.inventory_movements
  drop constraint inventory_movements_reason_check,
  add constraint inventory_movements_reason_check check (
    reason in ('initial_stock', 'order_confirmed', 'order_cancelled', 'manual_adjust', 'purchase_receipt')
  ),
  add column unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  add column receipt_id uuid references public.purchase_receipts (id);

create index inventory_movements_user_product_created_idx
  on public.inventory_movements (user_id, product_id, created_at);

-- -----------------------------------------------------------------------------
-- 4. RPC phiếu nhập
-- p_header: { supplier_name, supplier_phone, invoice_number, delivered_by, received_date, note }
-- p_items:  [{ product_id, ordered_qty, received_qty, defective_qty, unit_cost, condition_note }]
-- -----------------------------------------------------------------------------

-- Tạo mới (p_receipt_id null) hoặc cập nhật phiếu NHÁP; thay toàn bộ dòng hàng. Trả về id phiếu.
create function public.save_purchase_receipt(p_receipt_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid := p_receipt_id;
  v_status  public.receipt_status;
  v_count   int;
  v_supplier text := nullif(trim(coalesce(p_header ->> 'supplier_name', '')), '');
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_supplier is null then
    raise exception 'INVALID_SUPPLIER';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'RECEIPT_EMPTY';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count > 100 then
    raise exception 'TOO_MANY_ROWS';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(
      product_id uuid, ordered_qty int, received_qty int, defective_qty int, unit_cost numeric
    )
    where i.product_id is null
      or i.ordered_qty is null or i.ordered_qty < 1
      or i.received_qty is null or i.received_qty < 0
      or coalesce(i.defective_qty, 0) < 0
      or i.received_qty + coalesce(i.defective_qty, 0) > i.ordered_qty
      or i.unit_cost is null or i.unit_cost < 0
  ) then
    raise exception 'INVALID_RECEIPT_ITEM';
  end if;

  if (select count(distinct i.product_id) from jsonb_to_recordset(p_items) as i(product_id uuid))
     <> v_count then
    raise exception 'DUPLICATE_PRODUCT';
  end if;

  -- Mọi sản phẩm phải thuộc user hiện tại.
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(product_id uuid)
    where not exists (
      select 1 from public.products p where p.id = i.product_id and p.user_id = v_user_id
    )
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_id is null then
    insert into public.purchase_receipts (
      user_id, code, supplier_name, supplier_phone, invoice_number, delivered_by, received_date, note
    )
    values (
      v_user_id,
      public.next_receipt_code(v_user_id),
      v_supplier,
      nullif(trim(coalesce(p_header ->> 'supplier_phone', '')), ''),
      nullif(trim(coalesce(p_header ->> 'invoice_number', '')), ''),
      nullif(trim(coalesce(p_header ->> 'delivered_by', '')), ''),
      coalesce((p_header ->> 'received_date')::date, (now() at time zone 'Asia/Ho_Chi_Minh')::date),
      nullif(trim(coalesce(p_header ->> 'note', '')), '')
    )
    returning id into v_id;
  else
    select status into v_status
    from public.purchase_receipts
    where id = v_id and user_id = v_user_id
    for update;

    if not found then
      raise exception 'RECEIPT_NOT_FOUND';
    end if;
    if v_status <> 'draft' then
      raise exception 'RECEIPT_NOT_DRAFT';
    end if;

    update public.purchase_receipts set
      supplier_name = v_supplier,
      supplier_phone = nullif(trim(coalesce(p_header ->> 'supplier_phone', '')), ''),
      invoice_number = nullif(trim(coalesce(p_header ->> 'invoice_number', '')), ''),
      delivered_by = nullif(trim(coalesce(p_header ->> 'delivered_by', '')), ''),
      received_date = coalesce((p_header ->> 'received_date')::date, received_date),
      note = nullif(trim(coalesce(p_header ->> 'note', '')), ''),
      updated_at = now()
    where id = v_id;

    delete from public.purchase_receipt_items where receipt_id = v_id;
  end if;

  insert into public.purchase_receipt_items (
    receipt_id, product_id, ordered_qty, received_qty, defective_qty, unit_cost, condition_note, position
  )
  select
    v_id,
    (e.item ->> 'product_id')::uuid,
    (e.item ->> 'ordered_qty')::int,
    (e.item ->> 'received_qty')::int,
    coalesce((e.item ->> 'defective_qty')::int, 0),
    round((e.item ->> 'unit_cost')::numeric, 2),
    nullif(trim(coalesce(e.item ->> 'condition_note', '')), ''),
    e.ord::int
  from jsonb_array_elements(p_items) with ordinality as e(item, ord);

  update public.purchase_receipts r
  set total_amount = coalesce((
    select round(sum(it.received_qty * it.unit_cost))
    from public.purchase_receipt_items it
    where it.receipt_id = v_id
  ), 0)
  where r.id = v_id;

  return v_id;
end $$;

-- Duyệt nhập kho: cộng tồn SL thực nhận, cập nhật giá vốn bình quân, ghi lịch sử kho.
create function public.post_purchase_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status  public.receipt_status;
  r         record;
begin
  select status into v_status
  from public.purchase_receipts
  where id = p_receipt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;
  if v_status <> 'draft' then
    raise exception 'RECEIPT_NOT_DRAFT';
  end if;
  if not exists (select 1 from public.purchase_receipt_items where receipt_id = p_receipt_id) then
    raise exception 'RECEIPT_EMPTY';
  end if;
  if not exists (
    select 1 from public.purchase_receipt_items where receipt_id = p_receipt_id and received_qty > 0
  ) then
    raise exception 'RECEIPT_NO_RECEIVED';
  end if;

  -- Khóa theo product_id (cùng thứ tự với confirm_order) để tránh deadlock.
  for r in
    select product_id, received_qty, unit_cost
    from public.purchase_receipt_items
    where receipt_id = p_receipt_id and received_qty > 0
    order by product_id
  loop
    update public.products p
    set
      cost_price = round(
        (p.stock * p.cost_price + r.received_qty * r.unit_cost) / (p.stock + r.received_qty),
        2
      ),
      stock = p.stock + r.received_qty
    where p.id = r.product_id and p.user_id = v_user_id;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND' using detail = r.product_id::text;
    end if;

    insert into public.inventory_movements (user_id, product_id, delta, reason, unit_cost, receipt_id)
    values (v_user_id, r.product_id, r.received_qty, 'purchase_receipt', r.unit_cost, p_receipt_id);
  end loop;

  update public.purchase_receipts
  set status = 'posted', posted_at = now(), updated_at = now()
  where id = p_receipt_id;
end $$;

-- Xóa phiếu nháp (phiếu đã nhập kho là chứng từ đã ghi sổ, không xóa).
create function public.delete_purchase_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.receipt_status;
begin
  select status into v_status
  from public.purchase_receipts
  where id = p_receipt_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;
  if v_status <> 'draft' then
    raise exception 'RECEIPT_NOT_DRAFT';
  end if;

  delete from public.purchase_receipts where id = p_receipt_id;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Cập nhật luồng kho có sẵn để ghi giá vốn
-- -----------------------------------------------------------------------------

create or replace function public.log_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.inventory_movements (user_id, product_id, delta, reason, unit_cost)
    values (new.user_id, new.id, new.stock, 'initial_stock', new.cost_price);
  end if;
  return new;
end $$;

-- pending → confirmed: trừ kho + chốt giá vốn bình quân hiện tại vào dòng đơn.
create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r      record;
  v_cost numeric(14, 2);
begin
  if public.lock_own_order(p_order_id) <> 'pending' then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'ORDER_EMPTY';
  end if;

  for r in
    select id, product_id, quantity
    from public.order_items
    where order_id = p_order_id
    order by product_id
  loop
    update public.products
    set stock = stock - r.quantity
    where id = r.product_id and stock >= r.quantity
    returning cost_price into v_cost;

    if not found then
      raise exception 'INSUFFICIENT_STOCK' using detail = r.product_id::text;
    end if;

    update public.order_items set unit_cost = v_cost where id = r.id;

    insert into public.inventory_movements (user_id, product_id, delta, reason, order_id, unit_cost)
    values (auth.uid(), r.product_id, -r.quantity, 'order_confirmed', p_order_id, v_cost);
  end loop;

  update public.orders set status = 'confirmed' where id = p_order_id;
end $$;

-- pending|confirmed → cancelled: đơn đã xác nhận thì hoàn kho theo giá vốn đã chốt
-- (giá vốn bình quân được tính lại như một lần nhập).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status := public.lock_own_order(p_order_id);
  r record;
begin
  if v_status not in ('pending', 'confirmed') then
    raise exception 'INVALID_STATUS_TRANSITION' using detail = v_status::text || ' -> cancelled';
  end if;

  if v_status = 'confirmed' then
    for r in
      select i.product_id, i.quantity, coalesce(i.unit_cost, p.cost_price) as unit_cost
      from public.order_items i
      join public.products p on p.id = i.product_id
      where i.order_id = p_order_id
      order by i.product_id
    loop
      update public.products p
      set
        cost_price = round(
          (p.stock * p.cost_price + r.quantity * r.unit_cost) / (p.stock + r.quantity),
          2
        ),
        stock = p.stock + r.quantity
      where p.id = r.product_id;

      insert into public.inventory_movements (user_id, product_id, delta, reason, order_id, unit_cost)
      values (auth.uid(), r.product_id, r.quantity, 'order_cancelled', p_order_id, r.unit_cost);
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
end $$;

-- Điều chỉnh tay (kiểm kê, xuất hủy, nhập không qua phiếu): ghi theo giá vốn hiện tại,
-- không làm đổi giá vốn bình quân.
create or replace function public.adjust_stock(p_product_id uuid, p_delta int, p_note text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
  v_cost  numeric(14, 2);
begin
  if p_delta = 0 then
    raise exception 'INVALID_DELTA';
  end if;

  update public.products
  set stock = stock + p_delta
  where id = p_product_id and user_id = auth.uid() and stock + p_delta >= 0
  returning stock, cost_price into v_stock, v_cost;

  if not found then
    if exists (select 1 from public.products where id = p_product_id and user_id = auth.uid()) then
      raise exception 'INSUFFICIENT_STOCK' using detail = p_product_id::text;
    end if;
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  insert into public.inventory_movements (user_id, product_id, delta, reason, note, unit_cost)
  values (auth.uid(), p_product_id, p_delta, 'manual_adjust', p_note, v_cost);

  return v_stock;
end $$;

-- delete_product: sản phẩm đã có trên phiếu nhập cũng không xóa cứng được.
create or replace function public.delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.products
  where id = p_product_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if exists (select 1 from public.order_items where product_id = p_product_id)
     or exists (select 1 from public.purchase_receipt_items where product_id = p_product_id) then
    raise exception 'PRODUCT_IN_ORDERS';
  end if;

  delete from public.inventory_movements where product_id = p_product_id;
  delete from public.products where id = p_product_id;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Lịch sử import Excel
-- -----------------------------------------------------------------------------
create table public.product_imports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name      text not null check (length(file_name) between 1 and 255),
  -- Đường dẫn trong bucket product-imports (<user_id>/<uuid>.<ext>).
  file_path      text not null,
  file_size      bigint not null check (file_size >= 0),
  sheet_name     text,
  row_count      int not null check (row_count >= 0),
  imported_count int not null default 0 check (imported_count >= 0),
  published      boolean not null,
  created_at     timestamptz not null default now(),
  check (starts_with(file_path, user_id::text || '/'))
);

create index product_imports_user_created_idx on public.product_imports (user_id, created_at desc);

alter table public.product_imports enable row level security;
create policy "product_imports: select own" on public.product_imports
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.product_imports from anon;
revoke insert, update, delete on public.product_imports from authenticated;

alter table public.products
  add column import_id uuid references public.product_imports (id) on delete set null;
create index products_import_idx on public.products (import_id) where import_id is not null;

-- Nhập sản phẩm từ file + ghi lịch sử trong MỘT transaction (lỗi một dòng → không lưu gì).
-- p_file: { file_name, file_path, file_size, sheet_name, row_count }
-- p_products: [{ name, category, unit, cost_price, price, stock, low_stock_threshold, description }]
create function public.import_products(p_file jsonb, p_products jsonb, p_publish boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_import_id uuid;
  v_count     int;
  v_path      text := p_file ->> 'file_path';
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_products is null or jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'IMPORT_EMPTY';
  end if;
  if jsonb_array_length(p_products) > 500 then
    raise exception 'TOO_MANY_ROWS';
  end if;
  if v_path is null or not starts_with(v_path, v_user_id::text || '/')
     or nullif(trim(coalesce(p_file ->> 'file_name', '')), '') is null then
    raise exception 'INVALID_FILE';
  end if;

  insert into public.product_imports (
    user_id, file_name, file_path, file_size, sheet_name, row_count, published
  )
  values (
    v_user_id,
    left(p_file ->> 'file_name', 255),
    v_path,
    coalesce((p_file ->> 'file_size')::bigint, 0),
    nullif(left(coalesce(p_file ->> 'sheet_name', ''), 100), ''),
    coalesce((p_file ->> 'row_count')::int, jsonb_array_length(p_products)),
    coalesce(p_publish, false)
  )
  returning id into v_import_id;

  -- Ràng buộc CHECK của bảng products kiểm tra lại giá / tồn / mô tả; trigger cấp SKU và
  -- ghi tồn đầu kỳ theo giá vốn.
  insert into public.products (
    user_id, name, category, unit, cost_price, price, stock, low_stock_threshold, description,
    is_active, import_id
  )
  select
    v_user_id,
    trim(x.name),
    x.category,
    coalesce(nullif(trim(x.unit), ''), 'Cái'),
    coalesce(x.cost_price, 0),
    x.price,
    coalesce(x.stock, 0),
    coalesce(x.low_stock_threshold, 5),
    nullif(trim(coalesce(x.description, '')), ''),
    coalesce(p_publish, false),
    v_import_id
  from jsonb_to_recordset(p_products) as x(
    name text, category text, unit text, cost_price numeric, price numeric, stock int,
    low_stock_threshold int, description text
  );

  get diagnostics v_count = row_count;
  update public.product_imports set imported_count = v_count where id = v_import_id;

  return v_import_id;
end $$;

-- Bucket riêng tư cho file import (chỉ chủ sở hữu đọc / ghi; tải về qua signed URL).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-imports',
  'product-imports',
  false,
  10 * 1024 * 1024,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ]
)
on conflict (id) do nothing;

create policy "product-imports: select own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product-imports: insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product-imports: delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- 7. Báo cáo: thêm giá vốn hàng bán / lợi nhuận gộp (đổi kiểu trả về → drop rồi tạo lại)
-- Lợi nhuận gộp = doanh thu − giá vốn hàng bán (unit_cost chốt khi xác nhận đơn).
-- -----------------------------------------------------------------------------
drop function public.get_dashboard_kpis(int, text);
drop function public.get_inventory_summary();
drop function public.get_sales_summary(date, date, text);
drop function public.get_revenue_by_day(date, date, text);
drop function public.get_revenue_by_category(date, date, text);
drop function public.get_top_products_by_range(date, date, int, text);

-- Giá vốn hàng bán của một đơn (đã chốt).
create function public.order_cogs(p_order_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(i.quantity * coalesce(i.unit_cost, 0)), 0)
  from public.order_items i
  where i.order_id = p_order_id;
$$;

create function public.get_dashboard_kpis(p_days int, p_tz text default 'Asia/Ho_Chi_Minh')
returns table (
  revenue           numeric,
  prev_revenue      numeric,
  gross_profit      numeric,
  prev_gross_profit numeric,
  order_count       int,
  prev_order_count  int,
  pending_count     int,
  low_stock_count   int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      public.dashboard_range_start(p_days, p_tz) as cur_start,
      public.dashboard_range_start(p_days, p_tz) - make_interval(days => p_days) as prev_start
  ),
  sales as (
    select
      o.created_at >= b.cur_start as is_current,
      o.status,
      o.total,
      case when o.status in ('confirmed', 'shipping', 'delivered')
        then o.total - public.order_cogs(o.id) end as profit
    from public.orders o, bounds b
    where o.created_at >= b.prev_start
  )
  select
    coalesce(sum(total) filter (where is_current and profit is not null), 0)::numeric,
    coalesce(sum(total) filter (where not is_current and profit is not null), 0)::numeric,
    coalesce(sum(profit) filter (where is_current), 0)::numeric,
    coalesce(sum(profit) filter (where not is_current), 0)::numeric,
    (count(*) filter (where is_current and status <> 'cancelled'))::int,
    (count(*) filter (where not is_current and status <> 'cancelled'))::int,
    (select count(*) from public.orders p where p.status = 'pending')::int,
    (
      select count(*) from public.products p
      where p.is_active and p.stock <= p.low_stock_threshold
    )::int
  from sales;
$$;

create function public.get_inventory_summary()
returns table (
  product_count      int,
  low_stock_count    int,
  out_of_stock_count int,
  total_units        bigint,
  stock_value        numeric,
  retail_value       numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::int,
    (count(*) filter (where p.stock > 0 and p.stock <= p.low_stock_threshold))::int,
    (count(*) filter (where p.stock = 0))::int,
    coalesce(sum(p.stock), 0)::bigint,
    -- Giá trị tồn kho theo giá vốn (chuẩn kế toán) và theo giá bán (tham khảo).
    coalesce(round(sum(p.stock * p.cost_price)), 0)::numeric,
    coalesce(sum(p.stock * p.price), 0)::numeric
  from public.products p
  where p.is_active;
$$;

create function public.get_sales_summary(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (
  revenue              numeric,
  cogs                 numeric,
  order_count          int,
  items_sold           int,
  cancelled_count      int,
  purchase_value       numeric,
  purchase_qty         int,
  prev_revenue         numeric,
  prev_cogs            numeric,
  prev_order_count     int,
  prev_items_sold      int,
  prev_cancelled_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  o as (
    select
      ord.id,
      ord.status,
      ord.total,
      ord.created_at >= b.range_start as is_current,
      ord.status in ('confirmed', 'shipping', 'delivered') as is_sale
    from public.orders ord, b
    where ord.created_at >= b.prev_start and ord.created_at < b.range_end
  ),
  items as (
    select
      o.is_current,
      sum(i.quantity) as qty,
      sum(i.quantity * coalesce(i.unit_cost, 0)) as cogs
    from o
    join public.order_items i on i.order_id = o.id
    where o.is_sale
    group by o.is_current
  ),
  purchases as (
    select coalesce(sum(it.received_qty * it.unit_cost), 0) as value, coalesce(sum(it.received_qty), 0) as qty
    from public.purchase_receipts r
    join public.purchase_receipt_items it on it.receipt_id = r.id
    cross join b
    where r.status = 'posted' and r.posted_at >= b.range_start and r.posted_at < b.range_end
  )
  select
    coalesce((select sum(total) from o where is_current and is_sale), 0)::numeric,
    coalesce((select round(cogs) from items where is_current), 0)::numeric,
    (select count(*) from o where is_current and is_sale)::int,
    coalesce((select qty from items where is_current), 0)::int,
    (select count(*) from o where is_current and status = 'cancelled')::int,
    (select round(value) from purchases)::numeric,
    (select qty from purchases)::int,
    coalesce((select sum(total) from o where not is_current and is_sale), 0)::numeric,
    coalesce((select round(cogs) from items where not is_current), 0)::numeric,
    (select count(*) from o where not is_current and is_sale)::int,
    coalesce((select qty from items where not is_current), 0)::int,
    (select count(*) from o where not is_current and status = 'cancelled')::int;
$$;

create function public.get_revenue_by_day(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (day date, revenue numeric, cogs numeric, gross_profit numeric, order_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  days as (
    select generate_series(p_from::timestamp, p_to::timestamp, interval '1 day')::date as day
  ),
  sales as (
    select
      (o.created_at at time zone p_tz)::date as day,
      o.total,
      public.order_cogs(o.id) as cogs
    from public.orders o, b
    where o.created_at >= b.range_start
      and o.created_at < b.range_end
      and o.status in ('confirmed', 'shipping', 'delivered')
  ),
  daily as (
    select day, sum(total) as revenue, sum(cogs) as cogs, count(*) as order_count
    from sales
    group by day
  )
  select
    d.day,
    coalesce(x.revenue, 0)::numeric,
    coalesce(round(x.cogs), 0)::numeric,
    coalesce(round(x.revenue - x.cogs), 0)::numeric,
    coalesce(x.order_count, 0)::int
  from days d
  left join daily x using (day)
  order by d.day;
$$;

create function public.get_revenue_by_category(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (category text, revenue numeric, gross_profit numeric, quantity int)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    nullif(trim(p.category), ''),
    sum(i.quantity * i.unit_price)::numeric,
    round(sum(i.quantity * (i.unit_price - coalesce(i.unit_cost, 0))))::numeric,
    sum(i.quantity)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join b
  where o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by 1
  order by 2 desc;
$$;

create function public.get_top_products_by_range(
  p_from  date,
  p_to    date,
  p_limit int default 10,
  p_tz    text default 'Asia/Ho_Chi_Minh'
)
returns table (
  product_id    uuid,
  name          text,
  sku           text,
  quantity_sold int,
  revenue       numeric,
  gross_profit  numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    p.id,
    p.name,
    p.sku,
    sum(i.quantity)::int,
    sum(i.quantity * i.unit_price)::numeric,
    round(sum(i.quantity * (i.unit_price - coalesce(i.unit_cost, 0))))::numeric
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join b
  where o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by p.id, p.name, p.sku
  order by sum(i.quantity) desc, sum(i.quantity * i.unit_price) desc, p.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- Báo cáo xuất nhập tồn theo sản phẩm trong khoảng ngày (số lượng + giá trị theo giá vốn).
-- Tồn đầu kỳ = tổng biến động trước kỳ; nhập = biến động dương; xuất = biến động âm trong kỳ.
create function public.get_stock_ledger(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (
  product_id    uuid,
  sku           text,
  name          text,
  unit          text,
  opening_qty   int,
  opening_value numeric,
  in_qty        int,
  in_value      numeric,
  out_qty       int,
  out_value     numeric,
  closing_qty   int,
  closing_value numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  m as (
    select
      mv.product_id,
      mv.delta,
      mv.delta * coalesce(mv.unit_cost, 0) as value,
      mv.created_at < b.range_start as before_range
    from public.inventory_movements mv, b
    where mv.created_at < b.range_end
  ),
  agg as (
    select
      product_id,
      coalesce(sum(delta) filter (where before_range), 0) as opening_qty,
      coalesce(sum(value) filter (where before_range), 0) as opening_value,
      coalesce(sum(delta) filter (where not before_range and delta > 0), 0) as in_qty,
      coalesce(sum(value) filter (where not before_range and delta > 0), 0) as in_value,
      coalesce(-sum(delta) filter (where not before_range and delta < 0), 0) as out_qty,
      coalesce(-sum(value) filter (where not before_range and delta < 0), 0) as out_value
    from m
    group by product_id
  )
  select
    p.id,
    p.sku,
    p.name,
    p.unit,
    a.opening_qty::int,
    round(a.opening_value)::numeric,
    a.in_qty::int,
    round(a.in_value)::numeric,
    a.out_qty::int,
    round(a.out_value)::numeric,
    (a.opening_qty + a.in_qty - a.out_qty)::int,
    round(a.opening_value + a.in_value - a.out_value)::numeric
  from agg a
  join public.products p on p.id = a.product_id
  where a.opening_qty <> 0 or a.in_qty <> 0 or a.out_qty <> 0
  order by p.name;
$$;

-- Hiệu quả của một sản phẩm (toàn thời gian): bán ra, lợi nhuận, nhập hàng, tồn.
create function public.get_product_insight(p_product_id uuid)
returns table (
  qty_sold          int,
  revenue           numeric,
  cogs              numeric,
  gross_profit      numeric,
  qty_received      int,
  qty_defective     int,
  receipt_count     int,
  last_receipt_date date,
  last_receipt_cost numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with sold as (
    select
      coalesce(sum(i.quantity), 0) as qty,
      coalesce(sum(i.quantity * i.unit_price), 0) as revenue,
      coalesce(sum(i.quantity * coalesce(i.unit_cost, 0)), 0) as cogs
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.product_id = p_product_id and o.status in ('confirmed', 'shipping', 'delivered')
  ),
  received as (
    select
      coalesce(sum(it.received_qty), 0) as qty,
      coalesce(sum(it.defective_qty), 0) as defective,
      count(distinct r.id) as receipts
    from public.purchase_receipt_items it
    join public.purchase_receipts r on r.id = it.receipt_id
    where it.product_id = p_product_id and r.status = 'posted'
  ),
  last_receipt as (
    select r.received_date, it.unit_cost
    from public.purchase_receipt_items it
    join public.purchase_receipts r on r.id = it.receipt_id
    where it.product_id = p_product_id and r.status = 'posted'
    order by r.posted_at desc
    limit 1
  )
  select
    s.qty::int,
    s.revenue::numeric,
    round(s.cogs)::numeric,
    round(s.revenue - s.cogs)::numeric,
    rc.qty::int,
    rc.defective::int,
    rc.receipts::int,
    (select received_date from last_receipt),
    (select unit_cost from last_receipt)
  from sold s, received rc;
$$;

-- -----------------------------------------------------------------------------
-- 8. Function privileges
-- -----------------------------------------------------------------------------
revoke execute on function public.next_receipt_code(uuid) from public, anon, authenticated;
revoke execute on function public.save_purchase_receipt(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.post_purchase_receipt(uuid) from public, anon;
revoke execute on function public.delete_purchase_receipt(uuid) from public, anon;
revoke execute on function public.import_products(jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.order_cogs(uuid) from public, anon;
revoke execute on function public.get_dashboard_kpis(int, text) from public, anon;
revoke execute on function public.get_inventory_summary() from public, anon;
revoke execute on function public.get_sales_summary(date, date, text) from public, anon;
revoke execute on function public.get_revenue_by_day(date, date, text) from public, anon;
revoke execute on function public.get_revenue_by_category(date, date, text) from public, anon;
revoke execute on function public.get_top_products_by_range(date, date, int, text) from public, anon;
revoke execute on function public.get_stock_ledger(date, date, text) from public, anon;
revoke execute on function public.get_product_insight(uuid) from public, anon;

grant execute on function public.save_purchase_receipt(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.post_purchase_receipt(uuid) to authenticated;
grant execute on function public.delete_purchase_receipt(uuid) to authenticated;
grant execute on function public.import_products(jsonb, jsonb, boolean) to authenticated;
-- order_cogs được gọi trong function SECURITY INVOKER nên người gọi cần EXECUTE.
grant execute on function public.order_cogs(uuid) to authenticated;
grant execute on function public.get_dashboard_kpis(int, text) to authenticated;
grant execute on function public.get_inventory_summary() to authenticated;
grant execute on function public.get_sales_summary(date, date, text) to authenticated;
grant execute on function public.get_revenue_by_day(date, date, text) to authenticated;
grant execute on function public.get_revenue_by_category(date, date, text) to authenticated;
grant execute on function public.get_top_products_by_range(date, date, int, text) to authenticated;
grant execute on function public.get_stock_ledger(date, date, text) to authenticated;
grant execute on function public.get_product_insight(uuid) to authenticated;
