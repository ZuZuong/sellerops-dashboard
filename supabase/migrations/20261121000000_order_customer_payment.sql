-- =============================================================================
-- Đơn hàng: địa chỉ giao hàng, phương thức thanh toán, khách hàng đã lưu.
--
--  * orders.shipping_address / orders.payment_method: thông tin chốt trên từng đơn (đơn cũ để
--    null = không rõ, không đoán).
--  * customers: danh bạ khách của từng tài khoản, nhận diện theo số điện thoại. Lưu / cập nhật
--    qua create_order(p_save_customer => true) trong CÙNG transaction với tạo đơn.
--  * create_order: thêm p_shipping_address, p_payment_method, p_save_customer.
-- Mã lỗi mới: INVALID_ADDRESS, INVALID_PAYMENT_METHOD, PHONE_REQUIRED_TO_SAVE
-- =============================================================================

create type public.payment_method as enum ('cod', 'bank_transfer', 'cash', 'card', 'e_wallet');

alter table public.orders
  add column shipping_address text check (shipping_address is null or length(shipping_address) <= 500),
  add column payment_method public.payment_method;

-- -----------------------------------------------------------------------------
-- Khách hàng đã lưu
-- -----------------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (length(btrim(name)) between 1 and 200),
  phone          text not null check (phone ~ '^(\+84|0)\d{9}$'),
  address        text check (address is null or length(address) <= 500),
  payment_method public.payment_method,
  last_order_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, phone)
);

create index customers_user_recent_idx on public.customers (user_id, last_order_at desc nulls last);

alter table public.customers enable row level security;

create policy "customers: select own" on public.customers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "customers: delete own" on public.customers
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.customers from anon;
-- Thêm / sửa chỉ qua create_order để thông tin khách luôn khớp với đơn vừa tạo.
revoke insert, update on public.customers from authenticated;

-- -----------------------------------------------------------------------------
-- RPC: tạo đơn (thay bản cũ 3 tham số)
-- -----------------------------------------------------------------------------
drop function public.create_order(text, text, jsonb);

create function public.create_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_items            jsonb,
  p_shipping_address text default null,
  p_payment_method   text default 'cod',
  p_save_customer    boolean default false
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
  v_name     text := btrim(coalesce(p_customer_name, ''));
  v_phone    text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_address  text := nullif(btrim(coalesce(p_shipping_address, '')), '');
  v_payment  public.payment_method;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if length(v_name) = 0 or length(v_name) > 200 then
    raise exception 'INVALID_CUSTOMER';
  end if;

  if v_address is not null and length(v_address) > 500 then
    raise exception 'INVALID_ADDRESS';
  end if;

  if p_payment_method is null
     or not (p_payment_method = any (enum_range(null::public.payment_method)::text[])) then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  v_payment := p_payment_method::public.payment_method;

  if coalesce(p_save_customer, false) and v_phone is null then
    raise exception 'PHONE_REQUIRED_TO_SAVE';
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

  insert into public.orders (user_id, code, customer_name, customer_phone, shipping_address, payment_method)
  values (v_user_id, public.next_order_code(v_user_id), v_name, v_phone, v_address, v_payment)
  returning id into v_order_id;

  -- Trigger set_order_item_unit_price chốt giá và từ chối sản phẩm không thuộc user / ngừng bán;
  -- trigger recalculate_order_total cập nhật tổng tiền.
  insert into public.order_items (order_id, product_id, quantity)
  select v_order_id, i.product_id, i.quantity
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int);

  -- Lưu khách (theo SĐT): khách cũ được cập nhật tên / địa chỉ / phương thức mới nhất.
  -- CHECK của bảng customers chặn SĐT sai định dạng (client đã chuẩn hóa trước khi gửi).
  if coalesce(p_save_customer, false) then
    insert into public.customers as c (user_id, name, phone, address, payment_method, last_order_at)
    values (v_user_id, v_name, v_phone, v_address, v_payment, now())
    on conflict (user_id, phone) do update
      set name = excluded.name,
          address = excluded.address,
          payment_method = excluded.payment_method,
          last_order_at = excluded.last_order_at,
          updated_at = now();
  else
    -- Khách đã có trong danh bạ vẫn được cập nhật mốc đặt gần nhất (để gợi ý lên đầu).
    update public.customers c
      set last_order_at = now()
      where c.user_id = v_user_id and c.phone = v_phone;
  end if;

  return v_order_id;
end $$;

revoke execute on function public.create_order(text, text, jsonb, text, text, boolean) from public, anon;
grant execute on function public.create_order(text, text, jsonb, text, text, boolean) to authenticated;
