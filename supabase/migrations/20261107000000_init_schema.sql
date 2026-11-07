-- =============================================================================
-- SellerOps – schema khởi tạo
-- Nguyên tắc:
--   * RLS bật trên mọi bảng; mỗi user chỉ thấy dữ liệu của mình.
--   * Client KHÔNG được sửa trực tiếp: products.stock, orders.status, orders.total,
--     order_items.unit_price, inventory_movements. Các thay đổi này chỉ đi qua
--     RPC / trigger (security definer) để luôn atomic và có audit trail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.order_status as enum ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sku                 text not null check (length(trim(sku)) > 0),
  name                text not null check (length(trim(name)) > 0),
  category            text,
  price               numeric(12, 0) not null check (price >= 0),
  stock               int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (user_id, sku)
);

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code           text not null check (length(trim(code)) > 0),
  customer_name  text not null check (length(trim(customer_name)) > 0),
  customer_phone text,
  status         public.order_status not null default 'pending',
  total          numeric(12, 0) not null default 0 check (total >= 0),
  created_at     timestamptz not null default now(),
  unique (user_id, code)
);

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  -- Không cascade: sản phẩm đã nằm trong đơn thì không xóa cứng được (chỉ is_active = false).
  product_id uuid not null references public.products (id),
  quantity   int not null check (quantity > 0),
  -- Giá chốt tại thời điểm đặt; do trigger gán từ products.price, client không ghi.
  unit_price numeric(12, 0) not null check (unit_price >= 0),
  unique (order_id, product_id)
);

-- Lịch sử biến động kho (audit trail) – chỉ ghi qua function.
create table public.inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  delta      int not null check (delta <> 0),
  reason     text not null check (reason in ('initial_stock', 'order_confirmed', 'order_cancelled', 'manual_adjust')),
  order_id   uuid references public.orders (id),
  note       text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index products_user_name_idx on public.products (user_id, name);
create index orders_user_status_created_idx on public.orders (user_id, status, created_at desc);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index inventory_movements_user_created_idx on public.inventory_movements (user_id, created_at desc);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

-- products
create policy "products: select own" on public.products
  for select to authenticated using (user_id = (select auth.uid()));
create policy "products: insert own" on public.products
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "products: update own" on public.products
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "products: delete own" on public.products
  for delete to authenticated using (user_id = (select auth.uid()));

-- orders (không có policy delete: đơn chỉ được hủy qua cancel_order)
create policy "orders: select own" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "orders: insert own" on public.orders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "orders: update own" on public.orders
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- order_items: sở hữu qua orders; chỉ sửa được khi đơn còn pending
create policy "order_items: select own" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
create policy "order_items: insert into own pending order" on public.order_items
  for insert to authenticated with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid()) and o.status = 'pending'
    )
  );
create policy "order_items: update in own pending order" on public.order_items
  for update to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid()) and o.status = 'pending'
    )
  );
create policy "order_items: delete from own pending order" on public.order_items
  for delete to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select auth.uid()) and o.status = 'pending'
    )
  );

-- inventory_movements: chỉ đọc
create policy "inventory_movements: select own" on public.inventory_movements
  for select to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Column privileges – chặn client ghi các cột nghiệp vụ nhạy cảm
-- -----------------------------------------------------------------------------
revoke all on public.products, public.orders, public.order_items, public.inventory_movements from anon;

revoke insert, update on public.products from authenticated;
grant insert (sku, name, category, price, stock, low_stock_threshold, is_active) on public.products to authenticated;
grant update (sku, name, category, price, low_stock_threshold, is_active) on public.products to authenticated;

revoke insert, update, delete on public.orders from authenticated;
grant insert (code, customer_name, customer_phone) on public.orders to authenticated;
grant update (customer_name, customer_phone) on public.orders to authenticated;

revoke insert, update on public.order_items from authenticated;
grant insert (order_id, product_id, quantity) on public.order_items to authenticated;
grant update (quantity) on public.order_items to authenticated;

revoke insert, update, delete on public.inventory_movements from authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Ghi movement 'initial_stock' khi tạo sản phẩm có tồn kho ban đầu.
create function public.log_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.inventory_movements (user_id, product_id, delta, reason)
    values (new.user_id, new.id, new.stock, 'initial_stock');
  end if;
  return new;
end $$;

create trigger products_log_initial_stock
  after insert on public.products
  for each row execute function public.log_initial_stock();

-- Chốt unit_price từ giá hiện tại của sản phẩm; kiểm tra sản phẩm cùng chủ và đang bán.
create function public.set_order_item_unit_price()
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
    and p.user_id = o.user_id
    and p.is_active;

  if not found then
    raise exception 'PRODUCT_NOT_AVAILABLE' using detail = new.product_id::text;
  end if;

  new.unit_price := v_price;
  return new;
end $$;

create trigger order_items_set_unit_price
  before insert on public.order_items
  for each row execute function public.set_order_item_unit_price();

-- Tính lại orders.total mỗi khi order_items thay đổi.
create function public.recalculate_order_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
begin
  update public.orders o
  set total = coalesce((
    select sum(i.quantity * i.unit_price) from public.order_items i where i.order_id = v_order_id
  ), 0)
  where o.id = v_order_id;
  return null;
end $$;

create trigger order_items_recalculate_total
  after insert or update or delete on public.order_items
  for each row execute function public.recalculate_order_total();

-- -----------------------------------------------------------------------------
-- RPC: chuyển trạng thái đơn & điều chỉnh kho (atomic, một transaction)
-- Mã lỗi (message): ORDER_NOT_FOUND, ORDER_NOT_PENDING, ORDER_EMPTY,
--   INSUFFICIENT_STOCK, INVALID_STATUS_TRANSITION, PRODUCT_NOT_FOUND
-- -----------------------------------------------------------------------------

-- Khóa đơn của user hiện tại và trả về trạng thái; lỗi nếu không tồn tại / không sở hữu.
create function public.lock_own_order(p_order_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  select status into v_status
  from public.orders
  where id = p_order_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  return v_status;
end $$;

-- pending → confirmed: trừ kho từng dòng (khóa theo product_id để tránh deadlock).
create function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if public.lock_own_order(p_order_id) <> 'pending' then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'ORDER_EMPTY';
  end if;

  for r in
    select product_id, quantity
    from public.order_items
    where order_id = p_order_id
    order by product_id
  loop
    update public.products
    set stock = stock - r.quantity
    where id = r.product_id and stock >= r.quantity;

    if not found then
      raise exception 'INSUFFICIENT_STOCK' using detail = r.product_id::text;
    end if;

    insert into public.inventory_movements (user_id, product_id, delta, reason, order_id)
    values (auth.uid(), r.product_id, -r.quantity, 'order_confirmed', p_order_id);
  end loop;

  update public.orders set status = 'confirmed' where id = p_order_id;
end $$;

-- pending|confirmed → cancelled: hoàn kho nếu đơn đã confirmed.
create function public.cancel_order(p_order_id uuid)
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
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id
      order by product_id
    loop
      update public.products set stock = stock + r.quantity where id = r.product_id;

      insert into public.inventory_movements (user_id, product_id, delta, reason, order_id)
      values (auth.uid(), r.product_id, r.quantity, 'order_cancelled', p_order_id);
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
end $$;

-- confirmed → shipping
create function public.ship_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status := public.lock_own_order(p_order_id);
begin
  if v_status <> 'confirmed' then
    raise exception 'INVALID_STATUS_TRANSITION' using detail = v_status::text || ' -> shipping';
  end if;
  update public.orders set status = 'shipping' where id = p_order_id;
end $$;

-- shipping → delivered
create function public.deliver_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status := public.lock_own_order(p_order_id);
begin
  if v_status <> 'shipping' then
    raise exception 'INVALID_STATUS_TRANSITION' using detail = v_status::text || ' -> delivered';
  end if;
  update public.orders set status = 'delivered' where id = p_order_id;
end $$;

-- Điều chỉnh kho thủ công (nhập hàng / kiểm kê). Trả về tồn kho mới.
create function public.adjust_stock(p_product_id uuid, p_delta int, p_note text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
begin
  if p_delta = 0 then
    raise exception 'INVALID_DELTA';
  end if;

  update public.products
  set stock = stock + p_delta
  where id = p_product_id and user_id = auth.uid() and stock + p_delta >= 0
  returning stock into v_stock;

  if not found then
    if exists (select 1 from public.products where id = p_product_id and user_id = auth.uid()) then
      raise exception 'INSUFFICIENT_STOCK' using detail = p_product_id::text;
    end if;
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  insert into public.inventory_movements (user_id, product_id, delta, reason, note)
  values (auth.uid(), p_product_id, p_delta, 'manual_adjust', p_note);

  return v_stock;
end $$;

-- -----------------------------------------------------------------------------
-- Function privileges: chỉ user đã đăng nhập gọi được RPC; helper/trigger không public
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.confirm_order(uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.ship_order(uuid) to authenticated;
grant execute on function public.deliver_order(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid, int, text) to authenticated;
