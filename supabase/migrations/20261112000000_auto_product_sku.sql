-- =============================================================================
-- SellerOps – SKU sản phẩm tự sinh
--   Định dạng: DN-<TÊN SẢN PHẨM VIẾT LIỀN, KHÔNG DẤU, IN HOA>-<STT>
--   VD: "Áo thun basic" → DN-AOTHUNBASIC-001
--   * STT tăng dần theo từng cửa hàng (user), cấp atomic qua bảng đếm → không trùng khi tạo song song.
--   * SKU cố định sau khi tạo (đổi tên sản phẩm không đổi SKU); client không ghi được cột sku.
--   * Danh mục chuyển sang danh sách cố định phía client → bỏ RPC get_product_categories.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- Bộ đếm STT SKU cho từng user. Chỉ trigger (security definer) đọc/ghi; RLS bật, không có policy.
create table public.product_sku_counters (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  last_value int not null default 0 check (last_value >= 0)
);

alter table public.product_sku_counters enable row level security;
revoke all on public.product_sku_counters from anon, authenticated;

-- "Áo thun Đỏ #1" → "AOTHUNDO1"; tên không còn ký tự chữ/số nào → "SP".
create function public.sku_name_part(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      upper(regexp_replace(
        -- Gọi unaccent dạng 2 tham số: dạng 1 tham số tra từ điển theo search_path (đang rỗng).
        extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_name, '')),
        '[^A-Za-z0-9]', '', 'g'
      )),
      ''
    ),
    'SP'
  );
$$;

create function public.assign_product_sku()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  insert into public.product_sku_counters as c (user_id, last_value)
  values (new.user_id, 1)
  on conflict (user_id) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  -- Tối thiểu 3 chữ số (001); vượt 999 thì dài thêm, không bị cắt.
  new.sku := 'DN-' || public.sku_name_part(new.name) || '-'
    || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0');
  return new;
end $$;

create trigger products_assign_sku
  before insert on public.products
  for each row execute function public.assign_product_sku();

-- Giá trị mặc định chỉ để client không phải gửi sku; trigger luôn ghi đè trước khi kiểm tra ràng buộc.
alter table public.products alter column sku set default '';

-- SKU do DB quản lý: client không được tự đặt hay sửa.
revoke insert (sku), update (sku) on public.products from authenticated;

drop function if exists public.get_product_categories();

revoke execute on function public.sku_name_part(text) from public, anon, authenticated;
revoke execute on function public.assign_product_sku() from public, anon, authenticated;
