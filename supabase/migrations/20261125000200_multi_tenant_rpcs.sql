-- =============================================================================
-- Đa seller (3/3): audit_logs, RPC (onboarding, admin, danh mục, nghiệp vụ, báo cáo), Storage.
--
--  * Mọi RPC ghi dữ liệu kinh doanh mở đầu bằng require_approved_seller(): shop phải `approved`,
--    tài khoản không khóa — kể cả khi gọi thẳng API, không chỉ ở giao diện.
--  * Hàm báo cáo nhận p_seller_id (bỏ trống = shop của người gọi). Seller truyền id shop khác →
--    FORBIDDEN; admin truyền id nào cũng chỉ thấy số liệu của đúng shop đó (lọc tường minh,
--    không dựa vào RLS vì admin đọc được mọi shop).
--  * Hành động của admin (duyệt, từ chối, khóa / mở khóa) chỉ qua RPC và luôn ghi audit_logs
--    trong cùng transaction.
--
-- Mã lỗi mới: ACCOUNT_LOCKED, SELLER_NOT_FOUND, SELLER_NOT_APPROVED, FORBIDDEN, EMAIL_NOT_CONFIRMED,
--   ADMIN_CANNOT_BE_SELLER, APPLICATION_NOT_EDITABLE, APPLICATION_INCOMPLETE,
--   BUSINESS_LICENSE_REQUIRED, CATEGORY_REQUIRED, TERMS_NOT_ACCEPTED, INVALID_BUSINESS_TYPE,
--   NOT_ADMIN, INVALID_DECISION, SELLER_NOT_PENDING, REASON_REQUIRED, INVALID_SELLER_TRANSITION,
--   ACCOUNT_NOT_FOUND, CANNOT_LOCK_SELF, CANNOT_LOCK_ADMIN, CATEGORY_EDIT_NOT_ALLOWED,
--   INVALID_CATEGORY_NAME, CATEGORY_NAME_EXISTS, CATEGORY_NOT_FOUND, CATEGORY_IN_USE,
--   INVALID_MOVE_TARGET
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. audit_logs — chỉ admin đọc; chỉ RPC ghi
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text not null check (target_type in ('seller', 'account')),
  target_id   uuid not null,
  metadata    jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;
create policy "audit_logs: admin read" on public.audit_logs
  for select to authenticated using ((select public.is_admin()));
revoke all on public.audit_logs from anon;
revoke insert, update, delete on public.audit_logs from authenticated;

create function public.log_audit(
  p_action      text,
  p_target_type text,
  p_target_id   uuid,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Lý do (từ chối / khóa): bắt buộc, 1–1000 ký tự sau khi bỏ khoảng trắng thừa.
create function public.require_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if length(v_reason) = 0 or length(v_reason) > 1000 then
    raise exception 'REASON_REQUIRED';
  end if;
  return v_reason;
end $$;

create function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Đăng ký shop + hồ sơ
-- -----------------------------------------------------------------------------

-- Gọi sau khi email đã xác minh. Gọi lại nhiều lần trả về đúng shop đã có (idempotent),
-- không bao giờ tạo shop thứ hai. Admin không thể thành seller.
create function public.register_as_seller()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_confirmed timestamptz;
  v_role      public.user_role;
  v_locked    boolean;
  v_seller_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select u.email_confirmed_at into v_confirmed from auth.users u where u.id = v_uid;
  if v_confirmed is null then
    raise exception 'EMAIL_NOT_CONFIRMED';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  select p.role, p.is_locked into v_role, v_locked
  from public.profiles p where p.id = v_uid
  for update;

  if v_locked then
    raise exception 'ACCOUNT_LOCKED';
  end if;
  if v_role = 'admin' then
    raise exception 'ADMIN_CANNOT_BE_SELLER';
  end if;

  select s.id into v_seller_id from public.sellers s where s.owner_id = v_uid;
  if v_seller_id is not null then
    return v_seller_id;
  end if;

  insert into public.sellers (owner_id) values (v_uid) returning id into v_seller_id;
  update public.profiles set role = 'seller' where id = v_uid;
  return v_seller_id;
end $$;

-- Shop của người gọi khi hồ sơ còn sửa được (draft / rejected), khóa dòng để cập nhật.
create function public.lock_editable_application()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.current_seller_id();
  v_status    public.seller_status;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_seller_id is null then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  select s.status into v_status from public.sellers s where s.id = v_seller_id for update;
  if v_status not in ('draft', 'rejected') then
    raise exception 'APPLICATION_NOT_EDITABLE' using detail = v_status::text;
  end if;
  return v_seller_id;
end $$;

-- Slug duy nhất toàn nền tảng từ tên shop ("Shop Áo Đẹp" → "shop-ao-dep", trùng thì thêm hậu tố).
create function public.unique_seller_slug(p_shop_name text, p_seller_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := left(coalesce(public.slugify(p_shop_name), 'shop'), 60);
  v_slug text := v_base;
  v_n    int := 1;
begin
  v_base := btrim(v_base, '-');
  v_slug := v_base;
  while exists (select 1 from public.sellers s where s.slug = v_slug and s.id <> p_seller_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;

-- Lưu nháp: chỉ cập nhật các trường có trong p_data (bỏ trống = xóa giá trị). CHECK của bảng
-- sellers kiểm tra định dạng (MST, SĐT, email…) — client đã validate bằng Zod trước khi gửi.
-- p_data: { shop_name, business_type, business_name, tax_code, license_number, address,
--           representative_name, representative_phone, contact_email, main_category }
create function public.save_seller_application(p_data jsonb, p_step int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.lock_editable_application();
  v_data      jsonb := coalesce(p_data, '{}'::jsonb);
  v_type      text;
  s           public.sellers%rowtype;
begin
  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'INVALID_APPLICATION_DATA';
  end if;

  v_type := nullif(btrim(coalesce(v_data ->> 'business_type', '')), '');
  if v_data ? 'business_type' and v_type is not null
     and not (v_type = any (enum_range(null::public.business_type)::text[])) then
    raise exception 'INVALID_BUSINESS_TYPE';
  end if;

  select * into s from public.sellers where id = v_seller_id;

  update public.sellers set
    shop_name = case when v_data ? 'shop_name'
      then nullif(btrim(v_data ->> 'shop_name'), '') else s.shop_name end,
    business_type = case when v_data ? 'business_type'
      then v_type::public.business_type else s.business_type end,
    business_name = case when v_data ? 'business_name'
      then nullif(btrim(v_data ->> 'business_name'), '') else s.business_name end,
    tax_code = case when v_data ? 'tax_code'
      then nullif(btrim(v_data ->> 'tax_code'), '') else s.tax_code end,
    license_number = case when v_data ? 'license_number'
      then nullif(btrim(v_data ->> 'license_number'), '') else s.license_number end,
    address = case when v_data ? 'address'
      then nullif(btrim(v_data ->> 'address'), '') else s.address end,
    representative_name = case when v_data ? 'representative_name'
      then nullif(btrim(v_data ->> 'representative_name'), '') else s.representative_name end,
    representative_phone = case when v_data ? 'representative_phone'
      then nullif(btrim(v_data ->> 'representative_phone'), '') else s.representative_phone end,
    contact_email = case when v_data ? 'contact_email'
      then nullif(lower(btrim(v_data ->> 'contact_email')), '') else s.contact_email end,
    main_category = case when v_data ? 'main_category'
      then nullif(btrim(v_data ->> 'main_category'), '') else s.main_category end,
    current_step = least(greatest(coalesce(p_step, s.current_step), 1), 4)
  where id = v_seller_id;

  -- Slug đi theo tên shop.
  update public.sellers
  set slug = case when shop_name is null then null else public.unique_seller_slug(shop_name, id) end
  where id = v_seller_id;
end $$;

-- Gửi hồ sơ: đủ thông tin + giấy phép kinh doanh + ≥ 1 danh mục + đã xác nhận cam kết.
create function public.submit_seller_application(p_terms_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.lock_editable_application();
  v_terms     text := btrim(coalesce(p_terms_version, ''));
  v_missing   text[];
  s           public.sellers%rowtype;
begin
  select * into s from public.sellers where id = v_seller_id;

  v_missing := array_remove(array[
    case when s.shop_name is null then 'shop_name' end,
    case when s.business_type is null then 'business_type' end,
    case when s.business_name is null then 'business_name' end,
    case when s.tax_code is null then 'tax_code' end,
    case when s.license_number is null then 'license_number' end,
    case when s.address is null then 'address' end,
    case when s.representative_name is null then 'representative_name' end,
    case when s.representative_phone is null then 'representative_phone' end,
    case when s.contact_email is null then 'contact_email' end,
    case when s.main_category is null then 'main_category' end
  ], null);
  if cardinality(v_missing) > 0 then
    raise exception 'APPLICATION_INCOMPLETE' using detail = array_to_string(v_missing, ',');
  end if;

  if not exists (
    select 1 from public.seller_documents d
    where d.seller_id = v_seller_id and d.kind = 'business_license'
  ) then
    raise exception 'BUSINESS_LICENSE_REQUIRED';
  end if;

  if not exists (select 1 from public.categories c where c.seller_id = v_seller_id) then
    raise exception 'CATEGORY_REQUIRED';
  end if;

  if length(v_terms) = 0 or length(v_terms) > 50 then
    raise exception 'TERMS_NOT_ACCEPTED';
  end if;

  update public.sellers set
    status = 'pending',
    submitted_at = now(),
    terms_version = v_terms,
    terms_accepted_at = now(),
    current_step = 4
  where id = v_seller_id;

  perform public.log_audit(
    'seller.submitted', 'seller', v_seller_id,
    jsonb_build_object('terms_version', v_terms, 'resubmitted', s.status = 'rejected')
  );
end $$;

-- -----------------------------------------------------------------------------
-- 3. Hành động của admin (luôn ghi audit_logs)
-- -----------------------------------------------------------------------------

-- pending → approved | rejected (từ chối bắt buộc có lý do).
create function public.review_seller(p_seller_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.seller_status;
  v_reason text;
begin
  perform public.require_admin();
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  select s.status into v_status from public.sellers s where s.id = p_seller_id for update;
  if v_status is null then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  if v_status <> 'pending' then
    raise exception 'SELLER_NOT_PENDING' using detail = v_status::text;
  end if;

  if p_decision = 'rejected' then
    v_reason := public.require_reason(p_reason);
    update public.sellers set
      status = 'rejected', rejection_reason = v_reason, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_seller_id;
  else
    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    update public.sellers set
      status = 'approved', rejection_reason = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_seller_id;
  end if;

  perform public.log_audit(
    'seller.' || p_decision, 'seller', p_seller_id,
    jsonb_build_object('from', v_status, 'reason', v_reason)
  );
end $$;

-- approved ⇄ suspended (tạm khóa bắt buộc có lý do).
create function public.set_seller_suspended(p_seller_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.seller_status;
  v_to     public.seller_status := case when p_suspended then 'suspended' else 'approved' end;
  v_reason text;
begin
  perform public.require_admin();

  select s.status into v_status from public.sellers s where s.id = p_seller_id for update;
  if v_status is null then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  if not public.seller_status_can_transition(v_status, v_to) then
    raise exception 'INVALID_SELLER_TRANSITION' using detail = v_status::text || ' -> ' || v_to::text;
  end if;

  if p_suspended then
    v_reason := public.require_reason(p_reason);
    update public.sellers set status = 'suspended', suspended_reason = v_reason where id = p_seller_id;
  else
    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    update public.sellers set status = 'approved', suspended_reason = null where id = p_seller_id;
  end if;

  perform public.log_audit(
    case when p_suspended then 'seller.suspended' else 'seller.unsuspended' end,
    'seller', p_seller_id,
    jsonb_build_object('from', v_status, 'reason', v_reason)
  );
end $$;

-- Khóa / mở khóa tài khoản. Không khóa chính mình, không khóa admin khác.
create function public.set_account_locked(p_user_id uuid, p_locked boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   public.user_role;
  v_locked boolean;
  v_reason text;
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_LOCK_SELF';
  end if;

  select p.role, p.is_locked into v_role, v_locked
  from public.profiles p where p.id = p_user_id
  for update;
  if v_role is null then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  if v_role = 'admin' then
    raise exception 'CANNOT_LOCK_ADMIN';
  end if;

  if p_locked then
    v_reason := public.require_reason(p_reason);
    update public.profiles
    set is_locked = true, locked_reason = v_reason, locked_at = now()
    where id = p_user_id;
  else
    v_reason := nullif(btrim(coalesce(p_reason, '')), '');
    update public.profiles
    set is_locked = false, locked_reason = null, locked_at = null
    where id = p_user_id;
  end if;

  perform public.log_audit(
    case when p_locked then 'account.locked' else 'account.unlocked' end,
    'account', p_user_id,
    jsonb_build_object('was_locked', v_locked, 'reason', v_reason)
  );
end $$;

-- Danh sách tài khoản kèm email (auth.users), phân trang phía server. total_count lặp lại ở mỗi
-- dòng (window) để client không phải gọi thêm một lần đếm.
create function public.admin_list_accounts(
  p_q             text default null,
  p_role          public.user_role default null,
  p_locked        boolean default null,
  p_seller_status public.seller_status default null,
  p_page          int default 1,
  p_page_size     int default 20
)
returns table (
  id              uuid,
  email           text,
  full_name       text,
  phone           text,
  role            public.user_role,
  is_locked       boolean,
  locked_reason   text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  seller_id       uuid,
  shop_name       text,
  seller_status   public.seller_status,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q    text := lower(btrim(coalesce(p_q, '')));
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.require_admin();

  return query
  select
    p.id,
    u.email::text,
    p.full_name,
    p.phone,
    p.role,
    p.is_locked,
    p.locked_reason,
    p.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    s.id,
    s.shop_name,
    s.status,
    count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.sellers s on s.owner_id = p.id
  where (p_role is null or p.role = p_role)
    and (p_locked is null or p.is_locked = p_locked)
    and (p_seller_status is null or s.status = p_seller_status)
    and (
      v_q = ''
      or strpos(lower(coalesce(u.email, '')), v_q) > 0
      or strpos(lower(coalesce(p.full_name, '')), v_q) > 0
      or strpos(lower(coalesce(s.shop_name, '')), v_q) > 0
    )
  order by p.created_at desc, p.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

-- Số liệu toàn nền tảng cho trang tổng quan admin.
create function public.admin_platform_stats(p_days int default 30)
returns table (
  draft_count        int,
  pending_count      int,
  approved_count     int,
  rejected_count     int,
  suspended_count    int,
  total_revenue      numeric,
  period_revenue     numeric,
  total_orders       int,
  period_orders      int,
  total_accounts     int,
  new_accounts       int,
  locked_accounts    int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 366));
begin
  perform public.require_admin();

  return query
  select
    (select count(*) from public.sellers where status = 'draft')::int,
    (select count(*) from public.sellers where status = 'pending')::int,
    (select count(*) from public.sellers where status = 'approved')::int,
    (select count(*) from public.sellers where status = 'rejected')::int,
    (select count(*) from public.sellers where status = 'suspended')::int,
    coalesce((select sum(o.total) from public.orders o
              where o.status in ('confirmed', 'shipping', 'delivered')), 0)::numeric,
    coalesce((select sum(o.total) from public.orders o
              where o.status in ('confirmed', 'shipping', 'delivered') and o.created_at >= v_since), 0)::numeric,
    (select count(*) from public.orders o where o.status <> 'cancelled')::int,
    (select count(*) from public.orders o where o.status <> 'cancelled' and o.created_at >= v_since)::int,
    (select count(*) from public.profiles)::int,
    (select count(*) from public.profiles p where p.created_at >= v_since)::int,
    (select count(*) from public.profiles p where p.is_locked)::int;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Danh mục của shop
--    Sửa được khi shop đang làm hồ sơ (draft / rejected) hoặc đã duyệt; không sửa khi chờ duyệt
--    hoặc bị tạm khóa.
-- -----------------------------------------------------------------------------
create function public.require_category_editor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.current_seller_id();
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_seller_id is null then
    raise exception 'SELLER_NOT_FOUND';
  end if;
  if public.current_seller_status() not in ('draft', 'rejected', 'approved') then
    raise exception 'CATEGORY_EDIT_NOT_ALLOWED';
  end if;
  return v_seller_id;
end $$;

create function public.clean_category_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if length(v_name) not between 1 and 50 then
    raise exception 'INVALID_CATEGORY_NAME';
  end if;
  return v_name;
end $$;

create function public.unique_category_slug(p_seller_id uuid, p_name text, p_category_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text := left(coalesce(public.slugify(p_name), 'danh-muc'), 60);
  v_slug text;
  v_n    int := 1;
begin
  v_base := btrim(v_base, '-');
  v_slug := v_base;
  while exists (
    select 1 from public.categories c
    where c.seller_id = p_seller_id and c.slug = v_slug and c.id is distinct from p_category_id
  ) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;

create function public.create_category(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_category_editor();
  v_name      text := public.clean_category_name(p_name);
  v_id        uuid;
begin
  if exists (
    select 1 from public.categories c
    where c.seller_id = v_seller_id
      and public.normalize_product_name(c.name) = public.normalize_product_name(v_name)
  ) then
    raise exception 'CATEGORY_NAME_EXISTS';
  end if;

  insert into public.categories (seller_id, name, slug, sort_order)
  values (
    v_seller_id,
    v_name,
    public.unique_category_slug(v_seller_id, v_name, null),
    coalesce((select max(c.sort_order) + 1 from public.categories c where c.seller_id = v_seller_id), 0)
  )
  returning id into v_id;
  return v_id;
end $$;

-- Đổi tên / bật tắt. Sản phẩm trỏ theo id nên không phải cập nhật gì thêm.
create function public.update_category(p_id uuid, p_name text, p_is_active boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_category_editor();
  v_name      text := public.clean_category_name(p_name);
begin
  perform 1 from public.categories c where c.id = p_id and c.seller_id = v_seller_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.categories c
    where c.seller_id = v_seller_id and c.id <> p_id
      and public.normalize_product_name(c.name) = public.normalize_product_name(v_name)
  ) then
    raise exception 'CATEGORY_NAME_EXISTS';
  end if;

  update public.categories set
    name = v_name,
    slug = public.unique_category_slug(v_seller_id, v_name, p_id),
    is_active = coalesce(p_is_active, true)
  where id = p_id;
end $$;

-- Sắp xếp lại theo đúng thứ tự mảng id (id không thuộc shop bị bỏ qua).
create function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_category_editor();
begin
  update public.categories c
  set sort_order = x.ord - 1
  from unnest(coalesce(p_ids, '{}')) with ordinality as x(id, ord)
  where c.id = x.id and c.seller_id = v_seller_id;
end $$;

-- Xóa danh mục: đang có sản phẩm thì phải chỉ định danh mục khác CÙNG shop để chuyển sang.
create function public.delete_category(p_id uuid, p_move_to_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_category_editor();
  v_count     int;
begin
  perform 1 from public.categories c where c.id = p_id and c.seller_id = v_seller_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  select count(*) into v_count from public.products p where p.category_id = p_id;

  if v_count > 0 then
    if p_move_to_id is null then
      raise exception 'CATEGORY_IN_USE' using detail = v_count::text;
    end if;
    if p_move_to_id = p_id or not exists (
      select 1 from public.categories c where c.id = p_move_to_id and c.seller_id = v_seller_id
    ) then
      raise exception 'INVALID_MOVE_TARGET';
    end if;
    update public.products set category_id = p_move_to_id where category_id = p_id;
  end if;

  delete from public.categories where id = p_id;
  return jsonb_build_object('moved', v_count);
end $$;

-- Danh mục kèm số sản phẩm (trang Danh mục / bước 3 hồ sơ / admin xem shop).
create function public.get_category_overview(p_seller_id uuid default null)
returns table (
  id            uuid,
  name          text,
  slug          text,
  sort_order    int,
  is_active     boolean,
  product_count int,
  active_count  int,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid;
begin
  -- Seller xem được danh mục của mình ở MỌI trạng thái (bước 3 của hồ sơ); admin xem mọi shop.
  if p_seller_id is null or p_seller_id = public.current_seller_id() then
    v_seller_id := public.current_seller_id();
    if v_seller_id is null then
      raise exception 'SELLER_NOT_FOUND';
    end if;
  elsif public.is_admin() then
    v_seller_id := p_seller_id;
  else
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    c.id,
    c.name::text,
    c.slug,
    c.sort_order,
    c.is_active,
    count(p.id)::int,
    (count(p.id) filter (where p.is_active))::int,
    c.created_at
  from public.categories c
  left join public.products p on p.category_id = c.id
  where c.seller_id = v_seller_id
  group by c.id
  order by c.sort_order, c.name;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Nghiệp vụ đơn hàng / kho (viết lại theo shop)
-- -----------------------------------------------------------------------------

-- Khóa đơn của shop người gọi (đã duyệt) và trả về trạng thái.
create or replace function public.lock_own_order(p_order_id uuid)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_status    public.order_status;
begin
  select status into v_status
  from public.orders
  where id = p_order_id and seller_id = v_seller_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  return v_status;
end $$;

create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status    public.order_status := public.lock_own_order(p_order_id);
  v_seller_id uuid := public.require_approved_seller();
  r           record;
  v_cost      numeric(14, 2);
begin
  if v_status <> 'pending' then
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
    where id = r.product_id and seller_id = v_seller_id and stock >= r.quantity
    returning cost_price into v_cost;

    if not found then
      raise exception 'INSUFFICIENT_STOCK' using detail = r.product_id::text;
    end if;

    update public.order_items set unit_cost = v_cost where id = r.id;

    insert into public.inventory_movements (seller_id, product_id, delta, reason, order_id, unit_cost)
    values (v_seller_id, r.product_id, -r.quantity, 'order_confirmed', p_order_id, v_cost);
  end loop;

  update public.orders set status = 'confirmed' where id = p_order_id;
end $$;

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status    public.order_status := public.lock_own_order(p_order_id);
  v_seller_id uuid := public.require_approved_seller();
  r           record;
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
      where p.id = r.product_id and p.seller_id = v_seller_id;

      insert into public.inventory_movements (seller_id, product_id, delta, reason, order_id, unit_cost)
      values (v_seller_id, r.product_id, r.quantity, 'order_cancelled', p_order_id, r.unit_cost);
    end loop;
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
end $$;

-- ship_order / deliver_order giữ nguyên thân hàm: quyền kiểm tra trong lock_own_order.

create or replace function public.adjust_stock(p_product_id uuid, p_delta int, p_note text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_stock     int;
  v_cost      numeric(14, 2);
begin
  if p_delta = 0 then
    raise exception 'INVALID_DELTA';
  end if;

  update public.products
  set stock = stock + p_delta
  where id = p_product_id and seller_id = v_seller_id and stock + p_delta >= 0
  returning stock, cost_price into v_stock, v_cost;

  if not found then
    if exists (select 1 from public.products where id = p_product_id and seller_id = v_seller_id) then
      raise exception 'INSUFFICIENT_STOCK' using detail = p_product_id::text;
    end if;
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  insert into public.inventory_movements (seller_id, product_id, delta, reason, note, unit_cost)
  values (v_seller_id, p_product_id, p_delta, 'manual_adjust', p_note, v_cost);

  return v_stock;
end $$;

drop function public.next_order_code(uuid);
create function public.next_order_code(p_seller_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  insert into public.order_code_counters as c (seller_id, last_value)
  values (p_seller_id, 1)
  on conflict (seller_id) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  return 'DH-' || lpad(v_seq::text, greatest(6, length(v_seq::text)), '0');
end $$;

create or replace function public.create_order(
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
  v_seller_id uuid := public.require_approved_seller();
  v_order_id  uuid;
  v_count     int;
  v_name      text := btrim(coalesce(p_customer_name, ''));
  v_phone     text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_address   text := nullif(btrim(coalesce(p_shipping_address, '')), '');
  v_payment   public.payment_method;
begin
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

  insert into public.orders (seller_id, code, customer_name, customer_phone, shipping_address, payment_method)
  values (v_seller_id, public.next_order_code(v_seller_id), v_name, v_phone, v_address, v_payment)
  returning id into v_order_id;

  -- Trigger set_order_item_unit_price chốt giá và từ chối sản phẩm khác shop / ngừng bán;
  -- trigger recalculate_order_total cập nhật tổng tiền.
  insert into public.order_items (order_id, product_id, quantity)
  select v_order_id, i.product_id, i.quantity
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity int);

  if coalesce(p_save_customer, false) then
    insert into public.customers as c (seller_id, name, phone, address, payment_method, last_order_at)
    values (v_seller_id, v_name, v_phone, v_address, v_payment, now())
    on conflict (seller_id, phone) do update
      set name = excluded.name,
          address = excluded.address,
          payment_method = excluded.payment_method,
          last_order_at = excluded.last_order_at,
          updated_at = now();
  else
    update public.customers c
      set last_order_at = now()
      where c.seller_id = v_seller_id and c.phone = v_phone;
  end if;

  return v_order_id;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Phiếu nhập kho
-- -----------------------------------------------------------------------------
drop function public.next_receipt_code(uuid);
create function public.next_receipt_code(p_seller_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq int;
begin
  insert into public.purchase_receipt_counters as c (seller_id, last_value)
  values (p_seller_id, 1)
  on conflict (seller_id) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;
  return 'PN-' || lpad(v_seq::text, greatest(6, length(v_seq::text)), '0');
end $$;

create or replace function public.save_purchase_receipt(p_receipt_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_id        uuid := p_receipt_id;
  v_status    public.receipt_status;
  v_count     int;
  v_supplier  text := nullif(trim(coalesce(p_header ->> 'supplier_name', '')), '');
begin
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

  -- Mọi sản phẩm phải thuộc shop của người gọi.
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(product_id uuid)
    where not exists (
      select 1 from public.products p where p.id = i.product_id and p.seller_id = v_seller_id
    )
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_id is null then
    insert into public.purchase_receipts (
      seller_id, code, supplier_name, supplier_phone, invoice_number, delivered_by, received_date, note
    )
    values (
      v_seller_id,
      public.next_receipt_code(v_seller_id),
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
    where id = v_id and seller_id = v_seller_id
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

create or replace function public.post_purchase_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_status    public.receipt_status;
  r           record;
begin
  select status into v_status
  from public.purchase_receipts
  where id = p_receipt_id and seller_id = v_seller_id
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
    where p.id = r.product_id and p.seller_id = v_seller_id;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND' using detail = r.product_id::text;
    end if;

    insert into public.inventory_movements (seller_id, product_id, delta, reason, unit_cost, receipt_id)
    values (v_seller_id, r.product_id, r.received_qty, 'purchase_receipt', r.unit_cost, p_receipt_id);
  end loop;

  update public.purchase_receipts
  set status = 'posted', posted_at = now(), updated_at = now()
  where id = p_receipt_id;
end $$;

create or replace function public.delete_purchase_receipt(p_receipt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_status    public.receipt_status;
begin
  select status into v_status
  from public.purchase_receipts
  where id = p_receipt_id and seller_id = v_seller_id
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
-- 7. Sản phẩm: import, tên trùng, thùng rác
-- -----------------------------------------------------------------------------

-- p_products: [{ name, category, unit, cost_price, price, stock, low_stock_threshold,
--                description, is_active }] — `category` là TÊN danh mục của shop (đối chiếu không
-- phân biệt hoa thường / khoảng trắng); tên không có trong shop → CATEGORY_NOT_FOUND.
create or replace function public.import_products(p_file jsonb, p_products jsonb, p_publish boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_import_id uuid;
  v_count     int;
  v_published int;
  v_path      text := p_file ->> 'file_path';
  v_duplicate text;
  v_unknown   text;
begin
  if p_products is null or jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'IMPORT_EMPTY';
  end if;
  if jsonb_array_length(p_products) > 500 then
    raise exception 'TOO_MANY_ROWS';
  end if;
  if v_path is null or not starts_with(v_path, v_seller_id::text || '/')
     or nullif(trim(coalesce(p_file ->> 'file_name', '')), '') is null then
    raise exception 'INVALID_FILE';
  end if;

  select x.name into v_duplicate
  from jsonb_to_recordset(p_products) as x(name text)
  where exists (
    select 1 from public.products p
    where p.seller_id = v_seller_id
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

  select x.category into v_unknown
  from jsonb_to_recordset(p_products) as x(category text)
  where nullif(btrim(coalesce(x.category, '')), '') is not null
    and not exists (
      select 1 from public.categories c
      where c.seller_id = v_seller_id
        and public.normalize_product_name(c.name) = public.normalize_product_name(x.category)
    )
  limit 1;
  if v_unknown is not null then
    raise exception 'CATEGORY_NOT_FOUND' using detail = v_unknown;
  end if;

  insert into public.product_imports (
    seller_id, file_name, file_path, file_size, sheet_name, row_count, published
  )
  values (
    v_seller_id,
    left(p_file ->> 'file_name', 255),
    v_path,
    coalesce((p_file ->> 'file_size')::bigint, 0),
    nullif(left(coalesce(p_file ->> 'sheet_name', ''), 100), ''),
    coalesce((p_file ->> 'row_count')::int, jsonb_array_length(p_products)),
    false
  )
  returning id into v_import_id;

  insert into public.products (
    seller_id, name, category_id, unit, cost_price, price, stock, low_stock_threshold, description,
    is_active, import_id
  )
  select
    v_seller_id,
    trim(x.name),
    (
      select c.id from public.categories c
      where c.seller_id = v_seller_id
        and public.normalize_product_name(c.name) = public.normalize_product_name(x.category)
    ),
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

create or replace function public.find_existing_product_names(p_names text[])
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
    where p.seller_id = (select public.current_approved_seller_id())
      and public.normalize_product_name(p.name) = public.normalize_product_name(n)
  );
$$;

create or replace function public.trash_products(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id   uuid := public.require_approved_seller();
  v_trashed     int := 0;
  v_deactivated int := 0;
  r             public.products%rowtype;
begin
  for r in
    select * from public.products
    where id = any(coalesce(p_ids, '{}')) and seller_id = v_seller_id
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
      id, seller_id, sku, name, category, unit, price, cost_price, stock,
      hero_image_path, image_paths, product, movements
    )
    values (
      r.id, r.seller_id, r.sku, r.name,
      -- Tên danh mục lúc xóa (để hiển thị trong thùng rác, kể cả khi danh mục bị xóa sau đó).
      (select c.name from public.categories c where c.id = r.category_id),
      r.unit, r.price, r.cost_price, r.stock,
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

create or replace function public.restore_products(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_restored  int := 0;
  v_skipped   text[] := '{}';
  t           public.product_trash%rowtype;
  p           public.products%rowtype;
begin
  for t in
    select * from public.product_trash
    where id = any(coalesce(p_ids, '{}')) and seller_id = v_seller_id
    order by deleted_at
    for update
  loop
    if exists (
      select 1 from public.products
      where seller_id = v_seller_id
        and public.normalize_product_name(name) = public.normalize_product_name(t.name)
    ) then
      v_skipped := v_skipped || t.name::text;
      continue;
    end if;

    p := jsonb_populate_record(null::public.products, t.product);

    -- Danh mục cũ đã bị xóa → sản phẩm về "chưa có danh mục" (trigger chuyển về chưa đăng).
    -- stock = 0 để trigger tồn đầu kỳ không ghi thêm dòng; lịch sử kho cũ được chép lại nguyên vẹn.
    insert into public.products (
      id, seller_id, sku, name, category_id, unit, price, cost_price, stock, low_stock_threshold,
      is_active, description, hero_image_path, image_paths, import_id, created_at
    )
    values (
      p.id, v_seller_id, p.sku, p.name,
      (select c.id from public.categories c where c.id = p.category_id and c.seller_id = v_seller_id),
      p.unit, p.price, p.cost_price, 0,
      p.low_stock_threshold, p.is_active, p.description, p.hero_image_path, p.image_paths,
      (select i.id from public.product_imports i where i.id = p.import_id and i.seller_id = v_seller_id),
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

create or replace function public.purge_trash(p_ids uuid[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_paths     text[];
begin
  with deleted as (
    delete from public.product_trash
    where id = any(coalesce(p_ids, '{}')) and seller_id = v_seller_id
    returning seller_id, sku, hero_image_path, image_paths
  ),
  freed as (
    insert into public.product_sku_free_numbers (seller_id, value)
    select seller_id, public.sku_sequence(sku) from deleted
    where public.sku_sequence(sku) > 0
    on conflict do nothing
  )
  select coalesce(array_agg(path), '{}') into v_paths
  from deleted, unnest(array_prepend(hero_image_path, image_paths)) as path
  where path is not null;
  return v_paths;
end $$;

create or replace function public.purge_expired_trash()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid := public.require_approved_seller();
  v_paths     text[];
begin
  with deleted as (
    delete from public.product_trash
    where seller_id = v_seller_id and purge_at <= now()
    returning seller_id, sku, hero_image_path, image_paths
  ),
  freed as (
    insert into public.product_sku_free_numbers (seller_id, value)
    select seller_id, public.sku_sequence(sku) from deleted
    where public.sku_sequence(sku) > 0
    on conflict do nothing
  )
  select coalesce(array_agg(path), '{}') into v_paths
  from deleted, unnest(array_prepend(hero_image_path, image_paths)) as path
  where path is not null;
  return v_paths;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Báo cáo: thêm p_seller_id (bỏ trống = shop của người gọi)
--    plpgsql để bước kiểm tra quyền LUÔN chạy (hàm SQL thuần có thể bỏ qua subquery khi bảng
--    rỗng). #variable_conflict use_column: tên cột trả về trùng tên cột bảng.
-- -----------------------------------------------------------------------------
drop function public.get_dashboard_kpis(int, text);
drop function public.get_revenue_series(int, text);
drop function public.get_top_products(int, int, text);
drop function public.get_inventory_summary();
drop function public.get_sales_summary(date, date, text);
drop function public.get_revenue_by_day(date, date, text);
drop function public.get_revenue_by_category(date, date, text);
drop function public.get_top_products_by_range(date, date, int, text);
drop function public.get_stock_ledger(date, date, text);
drop function public.get_revenue_report(date, date, text);

create function public.get_dashboard_kpis(
  p_days      int,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
  v_cur_start timestamptz := public.dashboard_range_start(p_days, p_tz);
begin
  return query
  with sales as (
    select
      o.created_at >= v_cur_start as is_current,
      o.status,
      o.total,
      case when o.status in ('confirmed', 'shipping', 'delivered')
        then o.total - public.order_cogs(o.id) end as profit
    from public.orders o
    where o.seller_id = v_seller_id
      and o.created_at >= v_cur_start - make_interval(days => p_days)
  )
  select
    coalesce(sum(s.total) filter (where s.is_current and s.profit is not null), 0)::numeric,
    coalesce(sum(s.total) filter (where not s.is_current and s.profit is not null), 0)::numeric,
    coalesce(sum(s.profit) filter (where s.is_current), 0)::numeric,
    coalesce(sum(s.profit) filter (where not s.is_current), 0)::numeric,
    (count(*) filter (where s.is_current and s.status <> 'cancelled'))::int,
    (count(*) filter (where not s.is_current and s.status <> 'cancelled'))::int,
    (select count(*) from public.orders po where po.seller_id = v_seller_id and po.status = 'pending')::int,
    (
      select count(*) from public.products p
      where p.seller_id = v_seller_id and p.is_active and p.stock <= p.low_stock_threshold
    )::int
  from sales s;
end $$;

create function public.get_revenue_series(
  p_days      int,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
returns table (day date, revenue numeric, order_count int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
  v_start     timestamptz := public.dashboard_range_start(p_days, p_tz);
begin
  return query
  with days as (
    select generate_series(
      (v_start at time zone p_tz)::date::timestamp,
      (now() at time zone p_tz)::date::timestamp,
      interval '1 day'
    )::date as d
  ),
  daily as (
    select
      (o.created_at at time zone p_tz)::date as d,
      sum(o.total) as revenue,
      count(*) as order_count
    from public.orders o
    where o.seller_id = v_seller_id
      and o.created_at >= v_start
      and o.status in ('confirmed', 'shipping', 'delivered')
    group by 1
  )
  select days.d, coalesce(x.revenue, 0)::numeric, coalesce(x.order_count, 0)::int
  from days
  left join daily x on x.d = days.d
  order by days.d;
end $$;

create function public.get_top_products(
  p_days      int,
  p_limit     int default 5,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
returns table (product_id uuid, name text, sku text, quantity_sold int, revenue numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  select
    p.id,
    p.name::text,
    p.sku,
    sum(i.quantity)::int,
    sum(i.quantity * i.unit_price)::numeric
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  where o.seller_id = v_seller_id
    and o.created_at >= public.dashboard_range_start(p_days, p_tz)
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by p.id, p.name, p.sku
  order by sum(i.quantity) desc, sum(i.quantity * i.unit_price) desc, p.name
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
end $$;

create function public.get_inventory_summary(p_seller_id uuid default null)
returns table (
  product_count      int,
  low_stock_count    int,
  out_of_stock_count int,
  total_units        bigint,
  stock_value        numeric,
  retail_value       numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  select
    count(*)::int,
    (count(*) filter (where p.stock > 0 and p.stock <= p.low_stock_threshold))::int,
    (count(*) filter (where p.stock = 0))::int,
    coalesce(sum(p.stock), 0)::bigint,
    coalesce(round(sum(p.stock * p.cost_price)), 0)::numeric,
    coalesce(sum(p.stock * p.price), 0)::numeric
  from public.products p
  where p.seller_id = v_seller_id and p.is_active;
end $$;

create function public.get_sales_summary(
  p_from      date,
  p_to        date,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  o as (
    select
      ord.id,
      ord.status,
      ord.total,
      ord.created_at >= b.range_start as is_current,
      ord.status in ('confirmed', 'shipping', 'delivered') as is_sale
    from public.orders ord, b
    where ord.seller_id = v_seller_id
      and ord.created_at >= b.prev_start and ord.created_at < b.range_end
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
    select
      coalesce(sum(it.received_qty * it.unit_cost), 0) as value,
      coalesce(sum(it.received_qty), 0) as qty
    from public.purchase_receipts r
    join public.purchase_receipt_items it on it.receipt_id = r.id
    cross join b
    where r.seller_id = v_seller_id
      and r.status = 'posted' and r.posted_at >= b.range_start and r.posted_at < b.range_end
  )
  select
    coalesce((select sum(o.total) from o where o.is_current and o.is_sale), 0)::numeric,
    coalesce((select round(items.cogs) from items where items.is_current), 0)::numeric,
    (select count(*) from o where o.is_current and o.is_sale)::int,
    coalesce((select items.qty from items where items.is_current), 0)::int,
    (select count(*) from o where o.is_current and o.status = 'cancelled')::int,
    (select round(purchases.value) from purchases)::numeric,
    (select purchases.qty from purchases)::int,
    coalesce((select sum(o.total) from o where not o.is_current and o.is_sale), 0)::numeric,
    coalesce((select round(items.cogs) from items where not items.is_current), 0)::numeric,
    (select count(*) from o where not o.is_current and o.is_sale)::int,
    coalesce((select items.qty from items where not items.is_current), 0)::int,
    (select count(*) from o where not o.is_current and o.status = 'cancelled')::int;
end $$;

create function public.get_revenue_by_day(
  p_from      date,
  p_to        date,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
returns table (day date, revenue numeric, cogs numeric, gross_profit numeric, order_count int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  days as (
    select generate_series(p_from::timestamp, p_to::timestamp, interval '1 day')::date as d
  ),
  sales as (
    select
      (o.created_at at time zone p_tz)::date as d,
      o.total,
      public.order_cogs(o.id) as cogs
    from public.orders o, b
    where o.seller_id = v_seller_id
      and o.created_at >= b.range_start
      and o.created_at < b.range_end
      and o.status in ('confirmed', 'shipping', 'delivered')
  ),
  daily as (
    select sales.d, sum(sales.total) as revenue, sum(sales.cogs) as cogs, count(*) as order_count
    from sales
    group by sales.d
  )
  select
    days.d,
    coalesce(x.revenue, 0)::numeric,
    coalesce(round(x.cogs), 0)::numeric,
    coalesce(round(x.revenue - x.cogs), 0)::numeric,
    coalesce(x.order_count, 0)::int
  from days
  left join daily x on x.d = days.d
  order by days.d;
end $$;

-- Nhóm theo tên danh mục hiện tại (null = sản phẩm chưa có danh mục).
create function public.get_revenue_by_category(
  p_from      date,
  p_to        date,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
returns table (category text, revenue numeric, gross_profit numeric, quantity int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    c.name::text,
    sum(i.quantity * i.unit_price)::numeric,
    round(sum(i.quantity * (i.unit_price - coalesce(i.unit_cost, 0))))::numeric,
    sum(i.quantity)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  left join public.categories c on c.id = p.category_id
  cross join b
  where o.seller_id = v_seller_id
    and o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by c.name
  order by 2 desc;
end $$;

create function public.get_top_products_by_range(
  p_from      date,
  p_to        date,
  p_limit     int default 10,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
returns table (
  product_id    uuid,
  name          text,
  sku           text,
  quantity_sold int,
  revenue       numeric,
  gross_profit  numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    p.id,
    p.name::text,
    p.sku,
    sum(i.quantity)::int,
    sum(i.quantity * i.unit_price)::numeric,
    round(sum(i.quantity * (i.unit_price - coalesce(i.unit_cost, 0))))::numeric
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join b
  where o.seller_id = v_seller_id
    and o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by p.id, p.name, p.sku
  order by sum(i.quantity) desc, sum(i.quantity * i.unit_price) desc, p.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
end $$;

create function public.get_stock_ledger(
  p_from      date,
  p_to        date,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  m as (
    select
      mv.product_id,
      mv.delta,
      mv.delta * coalesce(mv.unit_cost, 0) as value,
      mv.created_at < b.range_start as before_range
    from public.inventory_movements mv, b
    where mv.seller_id = v_seller_id and mv.created_at < b.range_end
  ),
  agg as (
    select
      m.product_id,
      coalesce(sum(m.delta) filter (where m.before_range), 0) as opening_qty,
      coalesce(sum(m.value) filter (where m.before_range), 0) as opening_value,
      coalesce(sum(m.delta) filter (where not m.before_range and m.delta > 0), 0) as in_qty,
      coalesce(sum(m.value) filter (where not m.before_range and m.delta > 0), 0) as in_value,
      coalesce(-sum(m.delta) filter (where not m.before_range and m.delta < 0), 0) as out_qty,
      coalesce(-sum(m.value) filter (where not m.before_range and m.delta < 0), 0) as out_value
    from m
    group by m.product_id
  )
  select
    p.id,
    p.sku,
    p.name::text,
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
end $$;

create function public.get_revenue_report(
  p_from      date,
  p_to        date,
  p_tz        text default 'Asia/Ho_Chi_Minh',
  p_seller_id uuid default null
)
returns table (
  order_id       uuid,
  code           text,
  created_at     timestamptz,
  customer_name  text,
  payment_method public.payment_method,
  status         public.order_status,
  quantity       int,
  revenue        numeric,
  cogs           numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_seller_id uuid := public.resolve_report_seller(p_seller_id);
begin
  return query
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    o.id,
    o.code,
    o.created_at,
    o.customer_name,
    o.payment_method,
    o.status,
    coalesce(sum(i.quantity), 0)::int,
    o.total::numeric,
    round(coalesce(sum(i.quantity * coalesce(i.unit_cost, 0)), 0))::numeric
  from public.orders o
  cross join b
  left join public.order_items i on i.order_id = o.id
  where o.seller_id = v_seller_id
    and o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by o.id
  order by o.created_at, o.code;
end $$;

-- -----------------------------------------------------------------------------
-- 9. Storage
-- -----------------------------------------------------------------------------

-- Giấy tờ đăng ký kinh doanh: bucket RIÊNG TƯ, 5 MB, PDF / JPG / PNG.
-- Đường dẫn: {owner_id}/{kind}/{timestamp}-{tên-đã-làm-sạch}. Admin xem qua signed URL ngắn hạn.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-documents',
  'seller-documents',
  false,
  5 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Chủ shop: tải lên / đọc / xóa trong thư mục của mình CHỈ KHI hồ sơ còn sửa được.
-- Không có policy UPDATE: không ai ghi đè được file. Shop pending / approved: không ai xóa được.
create policy "seller-documents: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('business_license', 'representative_id')
    and (select public.current_seller_status()) in ('draft', 'rejected')
  );

create policy "seller-documents: owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.current_seller_status()) in ('draft', 'rejected')
  );

create policy "seller-documents: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.current_seller_status()) in ('draft', 'rejected')
  );

create policy "seller-documents: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'seller-documents' and (select public.is_admin()));

-- Ảnh sản phẩm / file import: thư mục theo SHOP ({seller_id}/…), chỉ shop đã duyệt ghi được.
drop policy if exists "product-images: insert own folder" on storage.objects;
drop policy if exists "product-images: update own folder" on storage.objects;
drop policy if exists "product-images: delete own folder" on storage.objects;
drop policy if exists "product-imports: select own folder" on storage.objects;
drop policy if exists "product-imports: insert own folder" on storage.objects;
drop policy if exists "product-imports: delete own folder" on storage.objects;

create policy "product-images: seller insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  );

create policy "product-images: seller update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  );

create policy "product-images: seller delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  );

create policy "product-imports: seller read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-imports'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  );

create policy "product-imports: seller insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-imports'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  );

create policy "product-imports: seller delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-imports'
    and (storage.foldername(name))[1] = (select public.current_approved_seller_id())::text
  );

create policy "product-imports: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-imports' and (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 10. Quyền gọi hàm
--     Đặt lại toàn bộ rồi cấp đúng danh sách: helper dùng trong RLS / giá trị mặc định / hàm
--     SECURITY INVOKER, và RPC client được gọi. Hàm nội bộ (trigger, bộ đếm, audit, kiểm tra
--     quyền dùng trong hàm SECURITY DEFINER) không cấp cho ai.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helper chạy với quyền người gọi (RLS, DEFAULT cột, CHECK, hàm SECURITY INVOKER)
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_seller_id() to authenticated;
grant execute on function public.current_seller_status() to authenticated;
grant execute on function public.current_approved_seller_id() to authenticated;
grant execute on function public.is_seller_approved(uuid) to authenticated;
grant execute on function public.resolve_report_seller(uuid) to authenticated;
grant execute on function public.paths_owned_by(text[], uuid) to authenticated;
grant execute on function public.normalize_product_name(text) to authenticated;
grant execute on function public.report_bounds(date, date, text) to authenticated;
grant execute on function public.dashboard_range_start(int, text) to authenticated;
grant execute on function public.order_cogs(uuid) to authenticated;
grant execute on function public.seller_status_can_transition(public.seller_status, public.seller_status) to authenticated;

-- Seller: hồ sơ + danh mục
grant execute on function public.register_as_seller() to authenticated;
grant execute on function public.save_seller_application(jsonb, int) to authenticated;
grant execute on function public.submit_seller_application(text) to authenticated;
grant execute on function public.create_category(text) to authenticated;
grant execute on function public.update_category(uuid, text, boolean) to authenticated;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
grant execute on function public.delete_category(uuid, uuid) to authenticated;
grant execute on function public.get_category_overview(uuid) to authenticated;

-- Seller: nghiệp vụ
grant execute on function public.confirm_order(uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.ship_order(uuid) to authenticated;
grant execute on function public.deliver_order(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid, int, text) to authenticated;
grant execute on function public.create_order(text, text, jsonb, text, text, boolean) to authenticated;
grant execute on function public.save_purchase_receipt(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.post_purchase_receipt(uuid) to authenticated;
grant execute on function public.delete_purchase_receipt(uuid) to authenticated;
grant execute on function public.import_products(jsonb, jsonb, boolean) to authenticated;
grant execute on function public.find_existing_product_names(text[]) to authenticated;
grant execute on function public.trash_products(uuid[]) to authenticated;
grant execute on function public.restore_products(uuid[]) to authenticated;
grant execute on function public.purge_trash(uuid[]) to authenticated;
grant execute on function public.purge_expired_trash() to authenticated;

-- Báo cáo (seller: shop mình; admin: shop bất kỳ, chỉ đọc)
grant execute on function public.get_dashboard_kpis(int, text, uuid) to authenticated;
grant execute on function public.get_revenue_series(int, text, uuid) to authenticated;
grant execute on function public.get_top_products(int, int, text, uuid) to authenticated;
grant execute on function public.get_inventory_summary(uuid) to authenticated;
grant execute on function public.get_sales_summary(date, date, text, uuid) to authenticated;
grant execute on function public.get_revenue_by_day(date, date, text, uuid) to authenticated;
grant execute on function public.get_revenue_by_category(date, date, text, uuid) to authenticated;
grant execute on function public.get_top_products_by_range(date, date, int, text, uuid) to authenticated;
grant execute on function public.get_stock_ledger(date, date, text, uuid) to authenticated;
grant execute on function public.get_revenue_report(date, date, text, uuid) to authenticated;
grant execute on function public.get_product_insight(uuid) to authenticated;

-- Admin (mỗi hàm tự kiểm tra is_admin() bên trong)
grant execute on function public.review_seller(uuid, text, text) to authenticated;
grant execute on function public.set_seller_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.set_account_locked(uuid, boolean, text) to authenticated;
grant execute on function public.admin_list_accounts(text, public.user_role, boolean, public.seller_status, int, int) to authenticated;
grant execute on function public.admin_platform_stats(int) to authenticated;
