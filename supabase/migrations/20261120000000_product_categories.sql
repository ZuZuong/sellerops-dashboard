-- =============================================================================
-- Danh mục sản phẩm do seller tự quản lý (thêm / đổi tên / xóa).
--
--  * product_categories: danh mục riêng của từng tài khoản (không trùng tên, không phân biệt
--    hoa thường / khoảng trắng thừa). Mỗi tài khoản mới được tạo sẵn bộ danh mục mặc định.
--  * products.category vẫn lưu tên danh mục (text) để báo cáo / tồn kho / CSV không phải đổi.
--  * products.category_missing: danh mục của sản phẩm không còn tồn tại (đã bị xóa). Trigger tự
--    tính lại mỗi khi category / is_active thay đổi và BẮT BUỘC sản phẩm đó về "lưu chưa đăng"
--    (is_active = false) — không thể đăng bán khi chưa chọn lại danh mục hợp lệ.
--  * rename_product_category: đổi tên → mọi sản phẩm (và sản phẩm trong thùng rác) đổi theo.
--  * delete_product_category: xóa → sản phẩm đang dùng bị gắn cờ category_missing, sản phẩm đang
--    bán chuyển về lưu chưa đăng.
-- Mã lỗi: INVALID_CATEGORY_NAME, CATEGORY_NAME_EXISTS, CATEGORY_NOT_FOUND, NOT_AUTHENTICATED
-- =============================================================================

create table public.product_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text collate "vi-x-icu" not null check (length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now()
);

create unique index product_categories_user_name_key
  on public.product_categories (user_id, public.normalize_product_name(name));

alter table public.product_categories enable row level security;
create policy "product_categories: select own" on public.product_categories
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.product_categories from anon;
-- Thêm / sửa / xóa chỉ qua RPC (đổi tên / xóa phải cập nhật sản phẩm trong cùng transaction).
revoke insert, update, delete on public.product_categories from authenticated;

-- -----------------------------------------------------------------------------
-- Danh mục mặc định (trước đây là hằng số PRODUCT_CATEGORIES ở client)
-- -----------------------------------------------------------------------------
create function public.seed_default_product_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_categories (user_id, name)
  select p_user_id, d.name
  from unnest(array[
    'Áo thun', 'Áo sơ mi', 'Áo polo', 'Áo khoác', 'Áo len', 'Quần jean', 'Quần tây',
    'Quần short', 'Chân váy', 'Đầm', 'Đồ bộ', 'Đồ thể thao', 'Đồ lót', 'Giày dép', 'Túi xách',
    'Phụ kiện'
  ]) as d(name)
  on conflict do nothing;
$$;

revoke execute on function public.seed_default_product_categories(uuid) from public, anon, authenticated;

create function public.handle_new_user_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_product_categories(new.id);
  return new;
end $$;

create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.handle_new_user_categories();

-- Tài khoản hiện có: danh mục mặc định + mọi danh mục đang được sản phẩm dùng.
select public.seed_default_product_categories(u.id) from auth.users u;

insert into public.product_categories (user_id, name)
select distinct on (p.user_id, public.normalize_product_name(p.category))
  p.user_id, left(btrim(p.category), 50)
from public.products p
where nullif(btrim(coalesce(p.category, '')), '') is not null
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Cờ "danh mục đã bị xóa" trên sản phẩm
-- -----------------------------------------------------------------------------
alter table public.products
  add column category_missing boolean not null default false;

create index products_user_category_missing_idx
  on public.products (user_id) where category_missing;

-- Chuẩn hóa tên danh mục theo đúng tên đã lưu ("ao thun" → "Áo thun"); không tìm thấy → gắn cờ
-- và chuyển về lưu chưa đăng.
create function public.check_product_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select c.name into v_name
  from public.product_categories c
  where c.user_id = new.user_id
    and public.normalize_product_name(c.name) = public.normalize_product_name(new.category);

  if v_name is null then
    new.category_missing := true;
    new.is_active := false;
  else
    new.category := v_name;
    new.category_missing := false;
  end if;
  return new;
end $$;

create trigger products_check_category
  before insert or update of category, is_active on public.products
  for each row execute function public.check_product_category();

-- Tính cờ cho dữ liệu hiện có (danh mục rỗng → cần cập nhật).
update public.products set category = category;

-- -----------------------------------------------------------------------------
-- RPC
-- -----------------------------------------------------------------------------

-- Danh mục kèm số sản phẩm đang dùng / đang bán (cho trang quản lý danh mục). RLS áp dụng.
create function public.get_product_category_overview()
returns table (id uuid, name text, product_count int, active_count int, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.name::text,
    count(p.id)::int,
    (count(p.id) filter (where p.is_active))::int,
    c.created_at
  from public.product_categories c
  left join public.products p
    on p.user_id = c.user_id and p.category = c.name
  where c.user_id = auth.uid()
  group by c.id
  order by c.name;
$$;

create function public.create_product_category(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if length(v_name) not between 1 and 50 then
    raise exception 'INVALID_CATEGORY_NAME';
  end if;

  insert into public.product_categories (user_id, name)
  values (v_user_id, v_name)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'CATEGORY_NAME_EXISTS';
  end if;

  -- Sản phẩm đang mang đúng tên này (vd. danh mục từng bị xóa rồi tạo lại) hết bị gắn cờ.
  -- Chúng vẫn ở trạng thái lưu chưa đăng — seller tự quyết định đăng lại.
  update public.products
  set category = category
  where user_id = v_user_id
    and category_missing
    and public.normalize_product_name(category) = public.normalize_product_name(v_name);

  return v_id;
end $$;

create function public.rename_product_category(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_old     text;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if length(v_name) not between 1 and 50 then
    raise exception 'INVALID_CATEGORY_NAME';
  end if;

  select name into v_old
  from public.product_categories
  where id = p_id and user_id = v_user_id
  for update;
  if v_old is null then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.product_categories
    where user_id = v_user_id and id <> p_id
      and public.normalize_product_name(name) = public.normalize_product_name(v_name)
  ) then
    raise exception 'CATEGORY_NAME_EXISTS';
  end if;

  update public.product_categories set name = v_name where id = p_id;

  -- is_active giữ nguyên (trigger chỉ ép về chưa đăng khi danh mục không tồn tại).
  update public.products
  set category = v_name
  where user_id = v_user_id and category = v_old;

  update public.product_trash
  set category = v_name,
      product = jsonb_set(product, '{category}', to_jsonb(v_name))
  where user_id = v_user_id and category = v_old;
end $$;

-- Xóa danh mục. Trả về { products, unpublished }: số sản phẩm đang dùng danh mục này và số
-- sản phẩm đang bán bị chuyển về lưu chưa đăng.
create function public.delete_product_category(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_name        text;
  v_products    int;
  v_unpublished int;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  delete from public.product_categories
  where id = p_id and user_id = v_user_id
  returning name into v_name;
  if v_name is null then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  select count(*), count(*) filter (where is_active)
  into v_products, v_unpublished
  from public.products
  where user_id = v_user_id and category = v_name;

  -- Trigger gắn cờ category_missing và chuyển về lưu chưa đăng.
  update public.products
  set category = category
  where user_id = v_user_id and category = v_name;

  return jsonb_build_object('products', v_products, 'unpublished', v_unpublished);
end $$;

revoke execute on function public.get_product_category_overview() from public, anon;
revoke execute on function public.create_product_category(text) from public, anon;
revoke execute on function public.rename_product_category(uuid, text) from public, anon;
revoke execute on function public.delete_product_category(uuid) from public, anon;
grant execute on function public.get_product_category_overview() to authenticated;
grant execute on function public.create_product_category(text) to authenticated;
grant execute on function public.rename_product_category(uuid, text) to authenticated;
grant execute on function public.delete_product_category(uuid) to authenticated;
