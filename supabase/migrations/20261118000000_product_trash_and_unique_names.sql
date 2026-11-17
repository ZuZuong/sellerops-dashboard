-- =============================================================================
-- Sản phẩm: thùng rác (khôi phục trong 30 ngày), kiểm tra trùng tên khi nhập Excel,
-- sắp xếp tên theo bảng chữ cái tiếng Việt.
--
--  * normalize_product_name: chuẩn hóa tên để so trùng (bỏ khoảng trắng thừa, không phân biệt
--    hoa thường).
--  * find_existing_product_names: tên nào trong danh sách đã có sản phẩm (dùng trước khi nhập).
--  * import_products: từ chối cả lô nếu có tên trùng với sản phẩm đã có / trùng nhau trong file.
--  * product_trash: "file" lưu sản phẩm đã xóa (ảnh chụp đầy đủ dòng sản phẩm + lịch sử kho).
--  * trash_products: xóa nhiều sản phẩm → chuyển vào thùng rác. Sản phẩm đã có trong đơn hàng /
--    phiếu nhập KHÔNG xóa được (giữ chứng từ) → chỉ chuyển sang ngừng bán.
--  * restore_products: khôi phục nguyên trạng (giữ id, SKU, ngày tạo, lịch sử kho).
--  * purge_trash / purge_expired_trash: xóa vĩnh viễn (ngay, hoặc quá hạn 30 ngày); trả về đường
--    dẫn ảnh để client xóa khỏi Storage.
-- Mã lỗi: DUPLICATE_PRODUCT_NAME, NOT_AUTHENTICATED
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sắp xếp tên theo tiếng Việt ("Áo" đứng cạnh "Ao", trước "Bút"), không theo mã byte.
-- -----------------------------------------------------------------------------
alter table public.products alter column name type text collate "vi-x-icu";

-- -----------------------------------------------------------------------------
-- 2. Tên trùng
-- -----------------------------------------------------------------------------
create function public.normalize_product_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

create index products_user_normalized_name_idx
  on public.products (user_id, public.normalize_product_name(name));

-- Trả về các tên (giữ nguyên chữ người dùng gửi) đã có sản phẩm cùng tên. RLS áp dụng.
create function public.find_existing_product_names(p_names text[])
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct n
  from unnest(coalesce(p_names, '{}')) as n
  where exists (
    select 1
    from public.products p
    where p.user_id = auth.uid()
      and public.normalize_product_name(p.name) = public.normalize_product_name(n)
  );
$$;

-- Nhập Excel: thêm kiểm tra trùng tên (phòng trường hợp dữ liệu thay đổi giữa lúc xem trước và
-- lúc bấm nhập). Phần còn lại giữ nguyên migration 20261117000000.
create or replace function public.import_products(p_file jsonb, p_products jsonb, p_publish boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_import_id uuid;
  v_count     int;
  v_published int;
  v_path      text := p_file ->> 'file_path';
  v_duplicate text;
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

  -- Trùng với sản phẩm đã có, hoặc trùng nhau ngay trong file.
  select x.name into v_duplicate
  from jsonb_to_recordset(p_products) as x(name text)
  where exists (
    select 1 from public.products p
    where p.user_id = v_user_id
      and public.normalize_product_name(p.name) = public.normalize_product_name(x.name)
  )
  limit 1;
  if v_duplicate is null then
    select min(x.name) into v_duplicate
    from jsonb_to_recordset(p_products) as x(name text)
    group by public.normalize_product_name(x.name)
    having count(*) > 1
    limit 1;
  end if;
  if v_duplicate is not null then
    raise exception 'DUPLICATE_PRODUCT_NAME' using detail = v_duplicate;
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
    false
  )
  returning id into v_import_id;

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
    coalesce(x.is_active, p_publish, false),
    v_import_id
  from jsonb_to_recordset(p_products) as x(
    name text, category text, unit text, cost_price numeric, price numeric, stock int,
    low_stock_threshold int, description text, is_active boolean
  );

  get diagnostics v_count = row_count;

  select count(*) filter (where p.is_active)
  into v_published
  from public.products p
  where p.import_id = v_import_id;

  update public.product_imports
  set imported_count  = v_count,
      published_count = v_published,
      published       = (v_published = v_count)
  where id = v_import_id;

  return v_import_id;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Thùng rác
-- -----------------------------------------------------------------------------

-- SKU: chỉ cấp mới khi chưa có. Client không ghi được cột sku (đã revoke), nên giá trị khác rỗng
-- chỉ đến từ restore_products (giữ nguyên SKU cũ khi khôi phục).
create or replace function public.assign_product_sku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  if coalesce(new.sku, '') <> '' then
    return new;
  end if;

  insert into public.product_sku_counters as c (user_id, last_value)
  values (new.user_id, 1)
  on conflict (user_id) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  -- Tối thiểu 3 chữ số (001); vượt 999 thì dài thêm, không bị cắt.
  new.sku := 'DN-' || public.sku_name_part(new.name) || '-'
    || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0');
  return new;
end $$;

create table public.product_trash (
  -- id gốc của sản phẩm: khôi phục giữ nguyên id.
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  sku             text not null,
  name            text collate "vi-x-icu" not null,
  category        text,
  unit            text not null,
  price           numeric(12, 0) not null,
  cost_price      numeric(14, 2) not null,
  stock           int not null,
  hero_image_path text,
  image_paths     text[] not null default '{}',
  -- Ảnh chụp đầy đủ dòng products và inventory_movements lúc xóa.
  product         jsonb not null,
  movements       jsonb not null default '[]',
  deleted_at      timestamptz not null default now(),
  purge_at        timestamptz not null default now() + interval '30 days'
);

create index product_trash_user_deleted_idx on public.product_trash (user_id, deleted_at desc);
create index product_trash_purge_idx on public.product_trash (user_id, purge_at);

alter table public.product_trash enable row level security;
create policy "product_trash: select own" on public.product_trash
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.product_trash from anon;
revoke insert, update, delete on public.product_trash from authenticated;

-- Xóa nhiều sản phẩm. Trả về { trashed, deactivated }:
--  trashed: số sản phẩm chuyển vào thùng rác;
--  deactivated: số sản phẩm đã có đơn hàng / phiếu nhập → chỉ chuyển sang ngừng bán.
create function public.trash_products(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_trashed     int := 0;
  v_deactivated int := 0;
  r             public.products%rowtype;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  for r in
    select * from public.products
    where id = any(coalesce(p_ids, '{}')) and user_id = v_user_id
    order by id
    for update
  loop
    if exists (select 1 from public.order_items where product_id = r.id)
       or exists (select 1 from public.purchase_receipt_items where product_id = r.id) then
      if r.is_active then
        update public.products set is_active = false where id = r.id;
      end if;
      v_deactivated := v_deactivated + 1;
      continue;
    end if;

    insert into public.product_trash (
      id, user_id, sku, name, category, unit, price, cost_price, stock,
      hero_image_path, image_paths, product, movements
    )
    values (
      r.id, r.user_id, r.sku, r.name, r.category, r.unit, r.price, r.cost_price, r.stock,
      r.hero_image_path, r.image_paths, to_jsonb(r),
      coalesce(
        (select jsonb_agg(to_jsonb(m) order by m.created_at)
         from public.inventory_movements m where m.product_id = r.id),
        '[]'
      )
    );

    delete from public.inventory_movements where product_id = r.id;
    delete from public.products where id = r.id;
    v_trashed := v_trashed + 1;
  end loop;

  return jsonb_build_object('trashed', v_trashed, 'deactivated', v_deactivated);
end $$;

-- Khôi phục từ thùng rác. Trả về { restored, skipped: [tên] }:
-- sản phẩm có tên trùng với sản phẩm đang có thì bỏ qua (vẫn nằm trong thùng rác).
create function public.restore_products(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_restored int := 0;
  v_skipped  text[] := '{}';
  t          public.product_trash%rowtype;
  p          public.products%rowtype;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  for t in
    select * from public.product_trash
    where id = any(coalesce(p_ids, '{}')) and user_id = v_user_id
    order by deleted_at
    for update
  loop
    if exists (
      select 1 from public.products
      where user_id = v_user_id
        and public.normalize_product_name(name) = public.normalize_product_name(t.name)
    ) then
      v_skipped := v_skipped || t.name::text;
      continue;
    end if;

    p := jsonb_populate_record(null::public.products, t.product);

    -- stock = 0 để trigger tồn đầu kỳ không ghi thêm dòng; lịch sử kho cũ được chép lại nguyên vẹn.
    insert into public.products (
      id, user_id, sku, name, category, unit, price, cost_price, stock, low_stock_threshold,
      is_active, description, hero_image_path, image_paths, import_id, created_at
    )
    values (
      p.id, v_user_id, p.sku, p.name, p.category, p.unit, p.price, p.cost_price, 0,
      p.low_stock_threshold, p.is_active, p.description, p.hero_image_path, p.image_paths,
      (select i.id from public.product_imports i where i.id = p.import_id),
      p.created_at
    );

    insert into public.inventory_movements
    select * from jsonb_populate_recordset(null::public.inventory_movements, t.movements);

    update public.products set stock = p.stock where id = p.id;
    delete from public.product_trash where id = t.id;
    v_restored := v_restored + 1;
  end loop;

  return jsonb_build_object('restored', v_restored, 'skipped', to_jsonb(v_skipped));
end $$;

-- Xóa vĩnh viễn các sản phẩm đã chọn trong thùng rác. Trả về đường dẫn ảnh cần xóa khỏi Storage.
create function public.purge_trash(p_ids uuid[])
returns text[]
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.product_trash
    where id = any(coalesce(p_ids, '{}')) and user_id = auth.uid()
    returning hero_image_path, image_paths
  )
  select coalesce(array_agg(path), '{}')
  from deleted, unnest(array_prepend(hero_image_path, image_paths)) as path
  where path is not null;
$$;

-- Dọn sản phẩm đã quá 30 ngày trong thùng rác (gọi mỗi khi mở danh sách / thùng rác).
create function public.purge_expired_trash()
returns text[]
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.product_trash
    where user_id = auth.uid() and purge_at <= now()
    returning hero_image_path, image_paths
  )
  select coalesce(array_agg(path), '{}')
  from deleted, unnest(array_prepend(hero_image_path, image_paths)) as path
  where path is not null;
$$;

revoke execute on function public.find_existing_product_names(text[]) from public, anon;
revoke execute on function public.trash_products(uuid[]) from public, anon;
revoke execute on function public.restore_products(uuid[]) from public, anon;
revoke execute on function public.purge_trash(uuid[]) from public, anon;
revoke execute on function public.purge_expired_trash() from public, anon;
grant execute on function public.find_existing_product_names(text[]) to authenticated;
grant execute on function public.trash_products(uuid[]) to authenticated;
grant execute on function public.restore_products(uuid[]) to authenticated;
grant execute on function public.purge_trash(uuid[]) to authenticated;
grant execute on function public.purge_expired_trash() to authenticated;
