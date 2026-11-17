-- =============================================================================
-- Dùng lại số thứ tự SKU của sản phẩm đã xóa vĩnh viễn.
--
-- Xóa vĩnh viễn DN-AOPOLO-005 (từ thùng rác) → số 005 được trả lại; sản phẩm tạo tiếp theo nhận
-- số trống nhỏ nhất trước, hết số trống mới tăng bộ đếm.
--  * Sản phẩm còn trong thùng rác vẫn giữ số (để khôi phục nguyên SKU).
--  * An toàn vì chỉ sản phẩm CHƯA từng có đơn hàng / phiếu nhập mới vào được thùng rác, nên
--    không chứng từ nào còn tham chiếu tới SKU cũ.
-- =============================================================================

create table public.product_sku_free_numbers (
  user_id uuid not null references auth.users (id) on delete cascade,
  value   int not null check (value > 0),
  primary key (user_id, value)
);

alter table public.product_sku_free_numbers enable row level security;
revoke all on public.product_sku_free_numbers from anon, authenticated;

-- Số thứ tự ở cuối SKU: "DN-AOPOLO-005" → 5; không đúng dạng → null.
create function public.sku_sequence(p_sku text)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(substring(p_sku from '-(\d{1,9})$'), '')::int;
$$;

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

  -- Ưu tiên số đã được trả lại (nhỏ nhất). Hai giao dịch tranh cùng một số thì bên chậm hơn
  -- xóa được 0 dòng → v_seq null → lấy số mới từ bộ đếm, không bao giờ trùng.
  delete from public.product_sku_free_numbers f
  where f.user_id = new.user_id
    and f.value = (
      select min(x.value) from public.product_sku_free_numbers x where x.user_id = new.user_id
    )
  returning f.value into v_seq;

  if v_seq is null then
    insert into public.product_sku_counters as c (user_id, last_value)
    values (new.user_id, 1)
    on conflict (user_id) do update set last_value = c.last_value + 1
    returning c.last_value into v_seq;
  end if;

  -- Tối thiểu 3 chữ số (001); vượt 999 thì dài thêm, không bị cắt.
  new.sku := 'DN-' || public.sku_name_part(new.name) || '-'
    || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0');
  return new;
end $$;

-- Xóa vĩnh viễn: trả số thứ tự SKU về danh sách số trống, trả về đường dẫn ảnh cần xóa.
create or replace function public.purge_trash(p_ids uuid[])
returns text[]
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.product_trash
    where id = any(coalesce(p_ids, '{}')) and user_id = auth.uid()
    returning user_id, sku, hero_image_path, image_paths
  ),
  freed as (
    insert into public.product_sku_free_numbers (user_id, value)
    select user_id, public.sku_sequence(sku) from deleted
    where public.sku_sequence(sku) > 0
    on conflict do nothing
  )
  select coalesce(array_agg(path), '{}')
  from deleted, unnest(array_prepend(hero_image_path, image_paths)) as path
  where path is not null;
$$;

create or replace function public.purge_expired_trash()
returns text[]
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.product_trash
    where user_id = auth.uid() and purge_at <= now()
    returning user_id, sku, hero_image_path, image_paths
  ),
  freed as (
    insert into public.product_sku_free_numbers (user_id, value)
    select user_id, public.sku_sequence(sku) from deleted
    where public.sku_sequence(sku) > 0
    on conflict do nothing
  )
  select coalesce(array_agg(path), '{}')
  from deleted, unnest(array_prepend(hero_image_path, image_paths)) as path
  where path is not null;
$$;

revoke execute on function public.sku_sequence(text) from public, anon;
