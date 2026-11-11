-- =============================================================================
-- SellerOps – Order Management
--   * order_status_events: lịch sử chuyển trạng thái của đơn (timeline trên trang chi tiết).
--     Ghi bằng trigger trên orders → mọi RPC chuyển trạng thái tự có lịch sử, client không ghi được.
--   * Mã đơn tự sinh theo từng cửa hàng: DH-000001, DH-000002… (cấp atomic qua bảng đếm).
--   * create_order: tạo đơn + các dòng hàng trong MỘT transaction. Giá chốt (unit_price) và tổng tiền
--     vẫn do trigger có sẵn tính, client chỉ gửi product_id + quantity.
--   * Tạo đơn KHÔNG trừ kho: kho chỉ trừ khi xác nhận (confirm_order).
-- Mã lỗi: INVALID_CUSTOMER, ORDER_EMPTY, TOO_MANY_ITEMS, INVALID_QUANTITY, DUPLICATE_PRODUCT,
--         PRODUCT_NOT_AVAILABLE (từ trigger set_order_item_unit_price)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lịch sử trạng thái
-- -----------------------------------------------------------------------------
create table public.order_status_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  status     public.order_status not null,
  created_at timestamptz not null default now()
);

create index order_status_events_order_idx on public.order_status_events (order_id, created_at);

alter table public.order_status_events enable row level security;

create policy "order_status_events: select own" on public.order_status_events
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.order_status_events from anon;
revoke insert, update, delete on public.order_status_events from authenticated;

create function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_events (order_id, user_id, status)
    values (new.id, new.user_id, new.status);
  end if;
  return null;
end $$;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Đơn có sẵn: ghi mốc tạo đơn; trạng thái hiện tại (nếu đã đổi) không biết thời điểm thật nên lấy
-- mốc tạo đơn làm xấp xỉ.
insert into public.order_status_events (order_id, user_id, status, created_at)
select o.id, o.user_id, 'pending', o.created_at from public.orders o;

insert into public.order_status_events (order_id, user_id, status, created_at)
select o.id, o.user_id, o.status, o.created_at from public.orders o where o.status <> 'pending';

-- -----------------------------------------------------------------------------
-- Mã đơn tự sinh
-- -----------------------------------------------------------------------------
create table public.order_code_counters (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  last_value int not null default 0 check (last_value >= 0)
);

alter table public.order_code_counters enable row level security;
revoke all on public.order_code_counters from anon, authenticated;

-- Khởi tạo bộ đếm từ mã đơn đã có dạng DH-<số> để không cấp trùng.
insert into public.order_code_counters (user_id, last_value)
select o.user_id, max(substring(o.code from '^DH-(\d{1,9})$')::int)
from public.orders o
where o.code ~ '^DH-\d{1,9}$'
group by o.user_id;

create function public.next_order_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  insert into public.order_code_counters as c (user_id, last_value)
  values (p_user_id, 1)
  on conflict (user_id) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  return 'DH-' || lpad(v_seq::text, greatest(6, length(v_seq::text)), '0');
end $$;

-- -----------------------------------------------------------------------------
-- RPC: tạo đơn
-- p_items: [{ "product_id": "<uuid>", "quantity": <int> }, ...]
-- -----------------------------------------------------------------------------
create function public.create_order(
  p_customer_name  text,
  p_customer_phone text,
  p_items          jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_order_id uuid;
  v_count    int;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) = 0
     or length(trim(p_customer_name)) > 200 then
    raise exception 'INVALID_CUSTOMER';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_EMPTY';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count > 50 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int)
    where i.product_id is null or i.quantity is null or i.quantity < 1
  ) then
    raise exception 'INVALID_QUANTITY';
  end if;

  if (select count(distinct i.product_id) from jsonb_to_recordset(p_items) as i(product_id uuid))
     <> v_count then
    raise exception 'DUPLICATE_PRODUCT';
  end if;

  insert into public.orders (user_id, code, customer_name, customer_phone)
  values (
    v_user_id,
    public.next_order_code(v_user_id),
    trim(p_customer_name),
    nullif(trim(coalesce(p_customer_phone, '')), '')
  )
  returning id into v_order_id;

  -- Trigger set_order_item_unit_price chốt giá và từ chối sản phẩm không thuộc user / ngừng bán;
  -- trigger recalculate_order_total cập nhật tổng tiền.
  insert into public.order_items (order_id, product_id, quantity)
  select v_order_id, i.product_id, i.quantity
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int);

  return v_order_id;
end $$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on function public.log_order_status() from public, anon, authenticated;
revoke execute on function public.next_order_code(uuid) from public, anon, authenticated;
revoke execute on function public.create_order(text, text, jsonb) from public, anon;
grant execute on function public.create_order(text, text, jsonb) to authenticated;
