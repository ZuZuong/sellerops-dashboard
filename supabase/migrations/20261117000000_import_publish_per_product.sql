-- =============================================================================
-- Nhập Excel: chọn đăng / lưu chưa đăng cho TỪNG sản phẩm.
--  - p_products[i].is_active (boolean, tùy chọn) quyết định trạng thái từng dòng;
--    bỏ trống → dùng p_publish như trước (giữ tương thích).
--  - product_imports.published_count: số sản phẩm được đăng ngay trong lần nhập.
--    published giữ nghĩa "đăng toàn bộ" (published_count = imported_count).
-- =============================================================================

alter table public.product_imports
  add column published_count int not null default 0 check (published_count >= 0);

update public.product_imports
set published_count = case when published then imported_count else 0 end;

-- p_file: { file_name, file_path, file_size, sheet_name, row_count }
-- p_products: [{ name, category, unit, cost_price, price, stock, low_stock_threshold,
--                description, is_active? }]
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
    false
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
