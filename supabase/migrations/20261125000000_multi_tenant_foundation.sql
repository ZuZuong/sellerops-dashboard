-- =============================================================================
-- Đa seller (1/3): nền tảng — kiểm tra dữ liệu sót, enum, profiles, sellers, giấy tờ, danh mục
-- và các hàm helper phân quyền.
--
--  * Role nằm trong public.profiles (KHÔNG dùng user_metadata / app_metadata do client ghi được).
--    User không tự đổi được role / is_locked (quyền theo cột + không có policy).
--  * Mỗi tài khoản seller sở hữu đúng 1 shop (sellers.owner_id unique). Dữ liệu kinh doanh tách
--    theo seller_id (migration 2/3), chỉ đọc / ghi được khi shop `approved` và tài khoản không khóa.
--  * State machine seller_status định nghĩa MỘT nơi ở SQL (seller_status_can_transition) và được
--    trigger áp dụng cho mọi thay đổi; bản TypeScript có test đối chiếu với hàm này.
--
-- Migration DỪNG nếu bảng kinh doanh còn dữ liệu: dữ liệu cũ gắn theo user_id không chuyển được
-- sang shop. Dọn bằng supabase/scripts/reset_product_data.sql rồi chạy lại.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Kiểm tra dữ liệu còn sót
-- -----------------------------------------------------------------------------
do $$
declare
  v_table    text;
  v_has_rows boolean;
  v_dirty    text[] := '{}';
  v_files    bigint;
begin
  foreach v_table in array array[
    'products', 'product_trash', 'product_imports', 'orders', 'order_items',
    'order_status_events', 'inventory_movements', 'purchase_receipts', 'purchase_receipt_items',
    'customers'
  ]
  loop
    execute format('select exists (select 1 from public.%I)', v_table) into v_has_rows;
    if v_has_rows then
      v_dirty := v_dirty || v_table;
    end if;
  end loop;

  if cardinality(v_dirty) > 0 then
    raise exception 'MULTI_TENANT_DATA_NOT_EMPTY: các bảng còn dữ liệu: %', array_to_string(v_dirty, ', ')
      using hint = 'Chạy supabase/scripts/reset_product_data.sql trong SQL Editor rồi chạy lại migration.';
  end if;

  -- File cũ nằm trong thư mục theo user id, sau migration không ai quản lý được nữa → chỉ cảnh báo.
  select count(*) into v_files
  from storage.objects
  where bucket_id in ('product-images', 'product-imports');
  if v_files > 0 then
    raise notice 'Còn % file trong bucket product-images / product-imports. Xóa trong Dashboard → Storage (xem reset_product_data.sql).', v_files;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Kiểu dữ liệu
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'seller', 'customer');
create type public.seller_status as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');
create type public.business_type as enum ('household', 'company', 'individual');
create type public.seller_document_kind as enum ('business_license', 'representative_id');

-- -----------------------------------------------------------------------------
-- 2. profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'customer',
  full_name  text check (full_name is null or length(full_name) <= 200),
  phone      text check (phone is null or phone ~ '^(\+84|0)\d{9}$'),
  is_locked     boolean not null default false,
  locked_reason text check (locked_reason is null or length(locked_reason) between 1 and 1000),
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  check (is_locked = (locked_at is not null))
);

create index profiles_role_idx on public.profiles (role);

-- Mọi user mới đều là `customer`; role seller chỉ được gán qua register_as_seller(),
-- role admin chỉ gán tay bằng SQL Editor (docs/admin-setup.md).
create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 200), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill: mọi tài khoản hiện có thành `customer` (admin gán tay sau, không tạo shop nào).
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- Tài khoản cũ được tạo sẵn 16 danh mục mẫu khi đăng ký — bỏ (seller tự tạo danh mục).
drop trigger if exists on_auth_user_created_seed_categories on auth.users;

-- -----------------------------------------------------------------------------
-- 3. sellers (shop) — mọi thay đổi đi qua RPC
-- -----------------------------------------------------------------------------
create table public.sellers (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null unique references auth.users (id) on delete cascade,
  status               public.seller_status not null default 'draft',
  shop_name            text check (shop_name is null or length(shop_name) between 2 and 100),
  slug                 text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  business_type        public.business_type,
  business_name        text check (business_name is null or length(business_name) between 2 and 200),
  -- Mã số thuế Việt Nam: 10 số, hoặc 10 số + "-" + 3 số (chi nhánh / địa điểm kinh doanh).
  tax_code             text check (tax_code is null or tax_code ~ '^\d{10}(-\d{3})?$'),
  license_number       text check (license_number is null or length(license_number) between 1 and 50),
  address              text check (address is null or length(address) between 5 and 500),
  representative_name  text check (representative_name is null or length(representative_name) between 2 and 200),
  representative_phone text check (representative_phone is null or representative_phone ~ '^(\+84|0)\d{9}$'),
  contact_email        text check (
    contact_email is null
    or (length(contact_email) <= 254 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  main_category        text check (main_category is null or length(main_category) between 1 and 100),
  -- Bước stepper đang làm (1–4) để tải lại trang quay về đúng bước.
  current_step         int not null default 1 check (current_step between 1 and 4),
  terms_version        text check (terms_version is null or length(terms_version) between 1 and 50),
  terms_accepted_at    timestamptz,
  submitted_at         timestamptz,
  reviewed_by          uuid references auth.users (id) on delete set null,
  reviewed_at          timestamptz,
  rejection_reason     text check (rejection_reason is null or length(rejection_reason) between 1 and 1000),
  suspended_reason     text check (suspended_reason is null or length(suspended_reason) between 1 and 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Ràng buộc nhất quán theo trạng thái (phòng hàm sai, không chỉ dựa vào RPC).
  check (status in ('draft') or submitted_at is not null),
  check (status not in ('approved', 'rejected', 'suspended') or reviewed_at is not null),
  check (status <> 'rejected' or rejection_reason is not null),
  check (status <> 'suspended' or suspended_reason is not null),
  check (status in ('draft') or terms_accepted_at is not null)
);

create index sellers_status_idx on public.sellers (status, submitted_at);
create index sellers_reviewed_by_idx on public.sellers (reviewed_by) where reviewed_by is not null;

-- State machine — NGUỒN DUY NHẤT phía database.
--   draft ──► pending ──► approved ◄──► suspended
--                │
--                └──► rejected ──► pending (sửa và gửi lại)
create function public.seller_status_can_transition(
  p_from public.seller_status,
  p_to   public.seller_status
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (p_from::text || '>' || p_to::text) = any (array[
    'draft>pending',
    'rejected>pending',
    'pending>approved',
    'pending>rejected',
    'approved>suspended',
    'suspended>approved'
  ]);
$$;

create function public.enforce_seller_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'SELLER_OWNER_IMMUTABLE';
  end if;
  if new.status is distinct from old.status
     and not public.seller_status_can_transition(old.status, new.status) then
    raise exception 'INVALID_SELLER_TRANSITION'
      using detail = old.status::text || ' -> ' || new.status::text;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger sellers_enforce_rules
  before update on public.sellers
  for each row execute function public.enforce_seller_rules();

-- -----------------------------------------------------------------------------
-- 4. seller_documents (file nằm ở bucket riêng tư seller-documents, migration 3/3)
-- -----------------------------------------------------------------------------
create table public.seller_documents (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.sellers (id) on delete cascade,
  kind         public.seller_document_kind not null,
  -- {owner_id}/{kind}/{timestamp}-{tên-đã-làm-sạch}
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/(business_license|representative_id)/[^/]+$'),
  file_name    text not null check (length(file_name) between 1 and 255),
  mime_type    text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size    bigint not null check (file_size between 1 and 5 * 1024 * 1024),
  created_at   timestamptz not null default now(),
  check (split_part(storage_path, '/', 2) = kind::text)
);

create index seller_documents_seller_idx on public.seller_documents (seller_id, kind);

-- -----------------------------------------------------------------------------
-- 5. categories — danh mục riêng của từng shop (ghi qua RPC, migration 3/3)
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.sellers (id) on delete cascade,
  name       text collate "vi-x-icu" not null check (length(btrim(name)) between 1 and 50),
  slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  -- Cho khóa ngoại kép (seller_id, category_id) từ products: sản phẩm chỉ trỏ được tới
  -- danh mục CÙNG shop, ràng buộc ngay ở database.
  unique (seller_id, id),
  unique (seller_id, slug)
);

-- Không trùng tên trong một shop (không phân biệt hoa thường / khoảng trắng thừa).
create unique index categories_seller_name_key
  on public.categories (seller_id, public.normalize_product_name(name));
create index categories_seller_order_idx on public.categories (seller_id, sort_order, name);

-- -----------------------------------------------------------------------------
-- 6. Helper phân quyền (security definer: đọc profiles / sellers bỏ qua RLS, không đệ quy)
--    Mọi helper đều xét profiles.is_locked: tài khoản bị khóa mất toàn bộ quyền.
-- -----------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.is_locked
  );
$$;

-- Shop của người gọi (bất kể trạng thái); null nếu không phải seller hoặc tài khoản bị khóa.
create function public.current_seller_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.sellers s
  join public.profiles p on p.id = s.owner_id
  where s.owner_id = auth.uid() and p.role = 'seller' and not p.is_locked;
$$;

create function public.current_seller_status()
returns public.seller_status
language sql
stable
security definer
set search_path = ''
as $$
  select s.status from public.sellers s where s.id = public.current_seller_id();
$$;

create function public.is_seller_approved(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sellers s
    join public.profiles p on p.id = s.owner_id
    where s.id = p_seller_id and s.status = 'approved' and p.role = 'seller' and not p.is_locked
  );
$$;

-- Shop của người gọi nếu ĐÃ DUYỆT; null nếu chưa (dùng trong RLS và giá trị mặc định cột).
create function public.current_approved_seller_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.sellers s
  join public.profiles p on p.id = s.owner_id
  where s.owner_id = auth.uid() and s.status = 'approved' and p.role = 'seller' and not p.is_locked;
$$;

-- Dùng ở đầu mọi RPC ghi dữ liệu kinh doanh: trả về shop đã duyệt hoặc raise mã lỗi rõ ràng.
create function public.require_approved_seller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_locked  boolean;
  v_seller  uuid;
  v_status  public.seller_status;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.is_locked into v_locked from public.profiles p where p.id = v_uid;
  if coalesce(v_locked, false) then
    raise exception 'ACCOUNT_LOCKED';
  end if;

  select s.id, s.status into v_seller, v_status
  from public.sellers s
  join public.profiles p on p.id = s.owner_id
  where s.owner_id = v_uid and p.role = 'seller';

  if v_seller is null then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  if v_status <> 'approved' then
    raise exception 'SELLER_NOT_APPROVED' using detail = v_status::text;
  end if;
  return v_seller;
end $$;

-- Hàm báo cáo: p_seller_id bỏ trống = shop của người gọi (phải đã duyệt); truyền id thì chỉ
-- chính chủ shop đó hoặc admin được xem. Trả về id shop đã kiểm tra quyền.
create function public.resolve_report_seller(p_seller_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_seller_id is null then
    return public.require_approved_seller();
  end if;
  if public.is_admin() then
    if not exists (select 1 from public.sellers s where s.id = p_seller_id) then
      raise exception 'SELLER_NOT_FOUND';
    end if;
    return p_seller_id;
  end if;
  if p_seller_id = public.current_approved_seller_id() then
    return p_seller_id;
  end if;
  raise exception 'FORBIDDEN';
end $$;

-- "Áo Thun Nam!" → "ao-thun-nam" (bỏ dấu tiếng Việt, kể cả đ → d).
create function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-'
    ),
    ''
  );
$$;

-- -----------------------------------------------------------------------------
-- 7. RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.seller_documents enable row level security;
alter table public.categories enable row level security;

-- profiles: tự đọc dòng của mình; admin đọc tất cả. Chỉ sửa được full_name / phone của mình
-- (quyền theo cột) → không bao giờ tự đổi được role / is_locked.
create policy "profiles: select own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin read" on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- sellers: chủ shop đọc shop của mình; admin đọc tất cả; không ghi trực tiếp (chỉ qua RPC).
create policy "sellers: select own" on public.sellers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "sellers: admin read" on public.sellers
  for select to authenticated using ((select public.is_admin()));

revoke all on public.sellers from anon;
revoke insert, update, delete on public.sellers from authenticated;

-- seller_documents: chủ shop đọc / thêm / xóa khi hồ sơ còn sửa được (draft, rejected);
-- admin chỉ đọc. Đường dẫn file phải nằm trong thư mục của chính người gọi.
create policy "seller_documents: select own editable" on public.seller_documents
  for select to authenticated using (
    seller_id = (select public.current_seller_id())
    and (select public.current_seller_status()) in ('draft', 'rejected')
  );
create policy "seller_documents: insert own editable" on public.seller_documents
  for insert to authenticated with check (
    seller_id = (select public.current_seller_id())
    and (select public.current_seller_status()) in ('draft', 'rejected')
    and starts_with(storage_path, (select auth.uid())::text || '/')
  );
create policy "seller_documents: delete own editable" on public.seller_documents
  for delete to authenticated using (
    seller_id = (select public.current_seller_id())
    and (select public.current_seller_status()) in ('draft', 'rejected')
  );
create policy "seller_documents: admin read" on public.seller_documents
  for select to authenticated using ((select public.is_admin()));

revoke all on public.seller_documents from anon;
revoke insert, update, delete on public.seller_documents from authenticated;
grant insert (seller_id, kind, storage_path, file_name, mime_type, file_size)
  on public.seller_documents to authenticated;
grant delete on public.seller_documents to authenticated;

-- categories: chủ shop đọc (cả lúc đang làm hồ sơ — bước 3 tạo danh mục); admin đọc.
-- Ghi qua RPC (chuẩn hóa tên, sinh slug, chặn trùng, chuyển sản phẩm khi xóa).
create policy "categories: select own" on public.categories
  for select to authenticated using (seller_id = (select public.current_seller_id()));
create policy "categories: admin read" on public.categories
  for select to authenticated using ((select public.is_admin()));

revoke all on public.categories from anon;
revoke insert, update, delete on public.categories from authenticated;
