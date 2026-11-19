-- =============================================================================
-- Admin Console: xóa mềm tài khoản kèm bằng chứng vi phạm, danh sách / tra cứu cho admin,
-- Realtime cho tài khoản và shop.
--
--  * Xóa tài khoản = XÓA MỀM, không bao giờ xóa vĩnh viễn:
--      active ──request_account_deletion──► pending_deletion ──confirm_account_deletion──► deleted
--        ▲                                        │                                          │
--        └──────────────── restore_account ───────┴──────────────────────────────────────────┘
--    Tài khoản pending_deletion / deleted luôn bị khóa (is_locked = true) → mọi helper phân quyền
--    (is_admin, current_seller_id, current_approved_seller_id…) đã tước quyền ngay lập tức.
--    Dữ liệu shop giữ nguyên để đối chiếu khi seller khiếu nại.
--  * Bằng chứng vi phạm: bucket RIÊNG TƯ `violation-evidence`, chỉ admin tải lên / xem.
--  * Mọi hành động admin ghi audit_logs trong cùng transaction.
--  * Realtime: profiles + sellers vào publication `supabase_realtime`. Realtime tôn trọng RLS nên
--    mỗi người chỉ nhận thay đổi trên dòng của chính mình → seller bị đá ra ngay khi bị xóa / khóa.
--
-- Mã lỗi mới: CANNOT_DELETE_SELF, CANNOT_DELETE_ADMIN, ACCOUNT_NOT_ACTIVE, INVALID_EVIDENCE,
--   TOO_MANY_EVIDENCE, DELETION_NOT_FOUND, DELETION_NOT_PENDING, DELETION_NOT_RESTORABLE,
--   ACCOUNT_PENDING_DELETION
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trạng thái tài khoản
-- -----------------------------------------------------------------------------
create type public.account_status as enum ('active', 'pending_deletion', 'deleted');
create type public.account_deletion_status as enum ('pending', 'confirmed', 'restored');

alter table public.profiles
  add column account_status public.account_status not null default 'active',
  -- Tài khoản đang chờ xóa / đã xóa luôn bị khóa.
  add constraint profiles_deleted_is_locked check (account_status = 'active' or is_locked);

create index profiles_account_status_idx on public.profiles (account_status)
  where account_status <> 'active';

-- -----------------------------------------------------------------------------
-- 2. Hồ sơ xóa tài khoản + bằng chứng
-- -----------------------------------------------------------------------------
create table public.account_deletions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  -- Shop của tài khoản lúc bị xóa (null nếu không phải seller).
  seller_id              uuid references public.sellers (id) on delete set null,
  status                 public.account_deletion_status not null default 'pending',
  reason                 text not null check (length(reason) between 1 and 1000),
  requested_by           uuid references auth.users (id) on delete set null,
  requested_at           timestamptz not null default now(),
  confirmed_by           uuid references auth.users (id) on delete set null,
  confirmed_at           timestamptz,
  restored_by            uuid references auth.users (id) on delete set null,
  restored_at            timestamptz,
  restore_note           text check (restore_note is null or length(restore_note) between 1 and 1000),
  -- Trạng thái khóa TRƯỚC khi xóa, để khôi phục đúng như cũ.
  previous_locked        boolean not null,
  previous_locked_reason text,
  previous_locked_at     timestamptz,
  -- Kết quả gửi email thông báo (Edge Function notify-account-deletion).
  notified_at            timestamptz,
  notify_error           text check (notify_error is null or length(notify_error) <= 500),
  check (status <> 'confirmed' or confirmed_at is not null),
  check (status <> 'restored' or restored_at is not null)
);

-- Mỗi tài khoản chỉ có tối đa một hồ sơ xóa đang hiệu lực (chờ xóa / đã xóa).
create unique index account_deletions_active_user_key
  on public.account_deletions (user_id) where status <> 'restored';
create index account_deletions_status_idx on public.account_deletions (status, requested_at desc);

create table public.account_deletion_evidence (
  id           uuid primary key default gen_random_uuid(),
  deletion_id  uuid not null references public.account_deletions (id) on delete cascade,
  -- {user_id}/{uuid}-{tên-đã-làm-sạch}
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[^/]+$'),
  file_name    text not null check (length(file_name) between 1 and 255),
  mime_type    text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size    bigint not null check (file_size between 1 and 10 * 1024 * 1024),
  created_at   timestamptz not null default now()
);

create index account_deletion_evidence_deletion_idx on public.account_deletion_evidence (deletion_id);

alter table public.account_deletions enable row level security;
alter table public.account_deletion_evidence enable row level security;

-- Chỉ admin đọc; không ai ghi trực tiếp (mọi thay đổi qua RPC).
create policy "account_deletions: admin read" on public.account_deletions
  for select to authenticated using ((select public.is_admin()));
create policy "account_deletion_evidence: admin read" on public.account_deletion_evidence
  for select to authenticated using ((select public.is_admin()));

revoke all on public.account_deletions from anon;
revoke insert, update, delete on public.account_deletions from authenticated;
revoke all on public.account_deletion_evidence from anon;
revoke insert, update, delete on public.account_deletion_evidence from authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage: bằng chứng vi phạm (riêng tư, chỉ admin)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'violation-evidence',
  'violation-evidence',
  false,
  10 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "violation-evidence: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'violation-evidence' and (select public.is_admin()));

create policy "violation-evidence: admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'violation-evidence' and (select public.is_admin()));

-- Chỉ xóa được file chưa gắn vào hồ sơ xóa nào (dọn file khi admin hủy thao tác / RPC lỗi).
-- Bằng chứng đã nộp không ai xóa được.
create policy "violation-evidence: admin delete unattached" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'violation-evidence'
    and (select public.is_admin())
    and not exists (
      select 1 from public.account_deletion_evidence e where e.storage_path = objects.name
    )
  );

-- -----------------------------------------------------------------------------
-- 4. RPC xóa / khôi phục tài khoản
-- -----------------------------------------------------------------------------

-- Admin xóa (mềm) một tài khoản: khóa ngay + đưa vào hàng "chờ xác nhận xóa".
-- p_evidence: [{ storage_path, file_name, mime_type, file_size }] — file đã tải lên bucket
-- violation-evidence trong thư mục {p_user_id}/.
create function public.request_account_deletion(
  p_user_id  uuid,
  p_reason   text,
  p_evidence jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason   text;
  v_evidence jsonb := coalesce(p_evidence, '[]'::jsonb);
  p          public.profiles%rowtype;
  v_seller   uuid;
  v_id       uuid;
  v_item     jsonb;
  v_path     text;
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_DELETE_SELF';
  end if;

  select * into p from public.profiles where id = p_user_id for update;
  if p.id is null then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  if p.role = 'admin' then
    raise exception 'CANNOT_DELETE_ADMIN';
  end if;
  if p.account_status <> 'active' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using detail = p.account_status::text;
  end if;

  v_reason := public.require_reason(p_reason);

  if jsonb_typeof(v_evidence) <> 'array' then
    raise exception 'INVALID_EVIDENCE';
  end if;
  if jsonb_array_length(v_evidence) > 10 then
    raise exception 'TOO_MANY_EVIDENCE';
  end if;

  select s.id into v_seller from public.sellers s where s.owner_id = p_user_id;

  insert into public.account_deletions (
    user_id, seller_id, reason, requested_by,
    previous_locked, previous_locked_reason, previous_locked_at
  )
  values (
    p_user_id, v_seller, v_reason, auth.uid(),
    p.is_locked, p.locked_reason, p.locked_at
  )
  returning id into v_id;

  for v_item in select x.value from jsonb_array_elements(v_evidence) as x(value) loop
    v_path := v_item ->> 'storage_path';
    -- File phải nằm trong thư mục của chính tài khoản bị xóa và đã thật sự được tải lên.
    if v_path is null
       or not starts_with(v_path, p_user_id::text || '/')
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'violation-evidence' and o.name = v_path
       ) then
      raise exception 'INVALID_EVIDENCE';
    end if;

    insert into public.account_deletion_evidence (deletion_id, storage_path, file_name, mime_type, file_size)
    values (
      v_id,
      v_path,
      left(coalesce(nullif(btrim(v_item ->> 'file_name'), ''), 'bang-chung'), 255),
      v_item ->> 'mime_type',
      (v_item ->> 'file_size')::bigint
    );
  end loop;

  update public.profiles set
    account_status = 'pending_deletion',
    is_locked = true,
    locked_reason = v_reason,
    locked_at = coalesce(locked_at, now())
  where id = p_user_id;

  perform public.log_audit(
    'account.deletion_requested', 'account', p_user_id,
    jsonb_build_object(
      'deletion_id', v_id,
      'reason', v_reason,
      'evidence_count', jsonb_array_length(v_evidence),
      'seller_id', v_seller
    )
  );
  return v_id;
end $$;

-- Chờ xóa → đã xóa (vẫn là xóa mềm: tài khoản khóa vĩnh viễn, dữ liệu giữ nguyên).
create function public.confirm_account_deletion(p_deletion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.account_deletions%rowtype;
begin
  perform public.require_admin();

  select * into d from public.account_deletions where id = p_deletion_id for update;
  if d.id is null then
    raise exception 'DELETION_NOT_FOUND';
  end if;
  if d.status <> 'pending' then
    raise exception 'DELETION_NOT_PENDING' using detail = d.status::text;
  end if;

  update public.account_deletions
  set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_deletion_id;

  update public.profiles set account_status = 'deleted' where id = d.user_id;

  perform public.log_audit(
    'account.deletion_confirmed', 'account', d.user_id,
    jsonb_build_object('deletion_id', d.id)
  );
end $$;

-- Khôi phục (sau khiếu nại thành công): trả lại đúng trạng thái khóa trước khi bị xóa.
create function public.restore_account(p_deletion_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d      public.account_deletions%rowtype;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 1000), '');
begin
  perform public.require_admin();

  select * into d from public.account_deletions where id = p_deletion_id for update;
  if d.id is null then
    raise exception 'DELETION_NOT_FOUND';
  end if;
  if d.status = 'restored' then
    raise exception 'DELETION_NOT_RESTORABLE';
  end if;

  update public.account_deletions
  set status = 'restored', restored_by = auth.uid(), restored_at = now(), restore_note = v_note
  where id = p_deletion_id;

  update public.profiles set
    account_status = 'active',
    is_locked = d.previous_locked,
    locked_reason = case when d.previous_locked then d.previous_locked_reason end,
    locked_at = case when d.previous_locked then coalesce(d.previous_locked_at, now()) end
  where id = d.user_id;

  perform public.log_audit(
    'account.deletion_restored', 'account', d.user_id,
    jsonb_build_object('deletion_id', d.id, 'from', d.status, 'note', v_note)
  );
end $$;

-- Khóa / mở khóa: không áp dụng cho tài khoản đang chờ xóa / đã xóa (phải khôi phục trước),
-- nếu không admin có thể vô tình mở khóa một tài khoản đã bị xóa.
create or replace function public.set_account_locked(p_user_id uuid, p_locked boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role   public.user_role;
  v_locked boolean;
  v_status public.account_status;
  v_reason text;
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_LOCK_SELF';
  end if;

  select p.role, p.is_locked, p.account_status into v_role, v_locked, v_status
  from public.profiles p where p.id = p_user_id
  for update;
  if v_role is null then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  if v_role = 'admin' then
    raise exception 'CANNOT_LOCK_ADMIN';
  end if;
  if v_status <> 'active' then
    raise exception 'ACCOUNT_PENDING_DELETION' using detail = v_status::text;
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

-- Dữ liệu dựng email thông báo xóa (Edge Function gọi bằng JWT của admin → chỉ admin đọc được).
create function public.admin_deletion_notice(p_deletion_id uuid)
returns table (
  email          text,
  full_name      text,
  shop_name      text,
  reason         text,
  requested_at   timestamptz,
  evidence_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  if not exists (select 1 from public.account_deletions d where d.id = p_deletion_id) then
    raise exception 'DELETION_NOT_FOUND';
  end if;

  return query
  select
    u.email::text,
    p.full_name,
    s.shop_name,
    d.reason,
    d.requested_at,
    (select count(*) from public.account_deletion_evidence e where e.deletion_id = d.id)::int
  from public.account_deletions d
  join auth.users u on u.id = d.user_id
  join public.profiles p on p.id = d.user_id
  left join public.sellers s on s.id = d.seller_id
  where d.id = p_deletion_id;
end $$;

-- Ghi kết quả gửi email (thành công → notified_at; lỗi → notify_error để admin gửi lại).
create function public.mark_deletion_notified(p_deletion_id uuid, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_error text := nullif(left(btrim(coalesce(p_error, '')), 500), '');
begin
  perform public.require_admin();
  update public.account_deletions set
    notified_at = case when v_error is null then now() else notified_at end,
    notify_error = v_error
  where id = p_deletion_id;
  if not found then
    raise exception 'DELETION_NOT_FOUND';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Danh sách / tra cứu cho Admin Console (mỗi hàm tự kiểm tra require_admin)
-- -----------------------------------------------------------------------------

-- Thêm trạng thái tài khoản vào danh sách tài khoản (đổi kiểu trả về → tạo lại).
drop function public.admin_list_accounts(text, public.user_role, boolean, public.seller_status, int, int);

create function public.admin_list_accounts(
  p_q              text default null,
  p_role           public.user_role default null,
  p_locked         boolean default null,
  p_seller_status  public.seller_status default null,
  p_page           int default 1,
  p_page_size      int default 20,
  p_account_status public.account_status default null
)
returns table (
  id              uuid,
  email           text,
  full_name       text,
  phone           text,
  role            public.user_role,
  account_status  public.account_status,
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
    p.account_status,
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
    and (p_account_status is null or p.account_status = p_account_status)
    and (
      v_q = ''
      or strpos(lower(coalesce(u.email, '')), v_q) > 0
      or strpos(lower(coalesce(p.full_name, '')), v_q) > 0
      or strpos(lower(coalesce(s.shop_name, '')), v_q) > 0
    )
  order by p.created_at desc, p.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

-- Thêm số tài khoản chờ xóa vào số liệu nền tảng.
drop function public.admin_platform_stats(int);

create function public.admin_platform_stats(p_days int default 30)
returns table (
  draft_count            int,
  pending_count          int,
  approved_count         int,
  rejected_count         int,
  suspended_count        int,
  total_revenue          numeric,
  period_revenue         numeric,
  total_orders           int,
  period_orders          int,
  total_accounts         int,
  new_accounts           int,
  locked_accounts        int,
  pending_deletion_count int
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
    (select count(*) from public.profiles p where p.is_locked and p.account_status = 'active')::int,
    (select count(*) from public.account_deletions d where d.status = 'pending')::int;
end $$;

-- Doanh số toàn nền tảng theo ngày (giờ Việt Nam) cho biểu đồ trang tổng quan admin.
create function public.admin_revenue_series(p_days int default 30)
returns table (day date, revenue numeric, orders int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_days  int := least(greatest(coalesce(p_days, 30), 1), 366);
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform public.require_admin();

  return query
  select
    g.day::date,
    coalesce(sum(o.total) filter (where o.status in ('confirmed', 'shipping', 'delivered')), 0)::numeric,
    (count(o.id) filter (where o.status <> 'cancelled'))::int
  from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as g(day)
  left join public.orders o
    on (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date = g.day::date
  group by g.day
  order by g.day;
end $$;

-- Danh sách shop kèm chủ shop và số liệu kinh doanh tóm tắt.
create function public.admin_list_sellers(
  p_q         text default null,
  p_status    public.seller_status default null,
  p_page      int default 1,
  p_page_size int default 20
)
returns table (
  id             uuid,
  shop_name      text,
  business_name  text,
  status         public.seller_status,
  owner_id       uuid,
  owner_email    text,
  account_status public.account_status,
  is_locked      boolean,
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  created_at     timestamptz,
  product_count  int,
  order_count    int,
  revenue        numeric,
  total_count    bigint
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
    s.id,
    s.shop_name,
    s.business_name,
    s.status,
    s.owner_id,
    u.email::text,
    p.account_status,
    p.is_locked,
    s.submitted_at,
    s.reviewed_at,
    s.created_at,
    (select count(*) from public.products pr where pr.seller_id = s.id)::int,
    (select count(*) from public.orders o where o.seller_id = s.id and o.status <> 'cancelled')::int,
    coalesce((select sum(o.total) from public.orders o
              where o.seller_id = s.id and o.status in ('confirmed', 'shipping', 'delivered')), 0)::numeric,
    count(*) over ()
  from public.sellers s
  join public.profiles p on p.id = s.owner_id
  join auth.users u on u.id = s.owner_id
  where (p_status is null or s.status = p_status)
    and (
      v_q = ''
      or strpos(lower(coalesce(s.shop_name, '')), v_q) > 0
      or strpos(lower(coalesce(s.business_name, '')), v_q) > 0
      or strpos(lower(coalesce(u.email, '')), v_q) > 0
      or strpos(lower(coalesce(s.tax_code, '')), v_q) > 0
    )
  -- Hàng đợi duyệt: hồ sơ gửi sớm nhất lên trước; còn lại mới nhất trước.
  order by
    case when p_status = 'pending' then s.submitted_at end asc nulls last,
    s.created_at desc,
    s.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

-- Chi tiết một shop + chủ shop (email nằm ở auth.users nên cần hàm SECURITY DEFINER).
create function public.admin_get_seller(p_seller_id uuid)
returns table (
  id                   uuid,
  owner_id             uuid,
  owner_email          text,
  owner_full_name      text,
  account_status       public.account_status,
  is_locked            boolean,
  locked_reason        text,
  status               public.seller_status,
  shop_name            text,
  slug                 text,
  business_type        public.business_type,
  business_name        text,
  tax_code             text,
  license_number       text,
  address              text,
  representative_name  text,
  representative_phone text,
  contact_email        text,
  main_category        text,
  terms_version        text,
  terms_accepted_at    timestamptz,
  submitted_at         timestamptz,
  reviewed_at          timestamptz,
  reviewer_email       text,
  rejection_reason     text,
  suspended_reason     text,
  created_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  if not exists (select 1 from public.sellers s where s.id = p_seller_id) then
    raise exception 'SELLER_NOT_FOUND';
  end if;

  return query
  select
    s.id, s.owner_id, u.email::text, p.full_name, p.account_status, p.is_locked, p.locked_reason,
    s.status, s.shop_name, s.slug, s.business_type, s.business_name, s.tax_code,
    s.license_number, s.address, s.representative_name, s.representative_phone,
    s.contact_email, s.main_category, s.terms_version, s.terms_accepted_at, s.submitted_at,
    s.reviewed_at, r.email::text, s.rejection_reason, s.suspended_reason, s.created_at
  from public.sellers s
  join public.profiles p on p.id = s.owner_id
  join auth.users u on u.id = s.owner_id
  left join auth.users r on r.id = s.reviewed_by
  where s.id = p_seller_id;
end $$;

-- Nhật ký hành động admin, kèm email người thực hiện và nhãn đối tượng (tên shop / email).
create function public.admin_list_audit_logs(
  p_actor_id  uuid default null,
  p_action    text default null,
  p_from      date default null,
  p_to         date default null,
  -- Lọc theo đối tượng (vd. shop + tài khoản chủ shop cho tab "Nhật ký" của một shop).
  p_target_ids uuid[] default null,
  p_page       int default 1,
  p_page_size int default 20
)
returns table (
  id           uuid,
  created_at   timestamptz,
  actor_id     uuid,
  actor_email  text,
  action       text,
  target_type  text,
  target_id    uuid,
  target_label text,
  metadata     jsonb,
  total_count  bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.require_admin();

  return query
  select
    a.id,
    a.created_at,
    a.actor_id,
    actor.email::text,
    a.action,
    a.target_type,
    a.target_id,
    case a.target_type
      when 'seller' then (select s.shop_name from public.sellers s where s.id = a.target_id)
      when 'account' then (select t.email::text from auth.users t where t.id = a.target_id)
    end,
    a.metadata,
    count(*) over ()
  from public.audit_logs a
  left join auth.users actor on actor.id = a.actor_id
  where (p_actor_id is null or a.actor_id = p_actor_id)
    and (p_action is null or a.action = p_action)
    and (p_target_ids is null or a.target_id = any (p_target_ids))
    and (p_from is null or a.created_at >= (p_from::timestamp at time zone 'Asia/Ho_Chi_Minh'))
    and (p_to is null or a.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'))
  order by a.created_at desc, a.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

-- Hồ sơ xóa tài khoản (p_status bỏ trống = mọi trạng thái).
create function public.admin_list_account_deletions(
  p_status    public.account_deletion_status default null,
  p_q         text default null,
  p_page      int default 1,
  p_page_size int default 20
)
returns table (
  id                 uuid,
  user_id            uuid,
  email              text,
  full_name          text,
  role               public.user_role,
  seller_id          uuid,
  shop_name          text,
  status             public.account_deletion_status,
  reason             text,
  requested_at       timestamptz,
  requested_by_email text,
  confirmed_at       timestamptz,
  restored_at        timestamptz,
  restore_note       text,
  notified_at        timestamptz,
  notify_error       text,
  evidence_count     int,
  total_count        bigint
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
    d.id,
    d.user_id,
    u.email::text,
    p.full_name,
    p.role,
    d.seller_id,
    s.shop_name,
    d.status,
    d.reason,
    d.requested_at,
    rb.email::text,
    d.confirmed_at,
    d.restored_at,
    d.restore_note,
    d.notified_at,
    d.notify_error,
    (select count(*) from public.account_deletion_evidence e where e.deletion_id = d.id)::int,
    count(*) over ()
  from public.account_deletions d
  join auth.users u on u.id = d.user_id
  join public.profiles p on p.id = d.user_id
  left join public.sellers s on s.id = d.seller_id
  left join auth.users rb on rb.id = d.requested_by
  where (p_status is null or d.status = p_status)
    and (
      v_q = ''
      or strpos(lower(coalesce(u.email, '')), v_q) > 0
      or strpos(lower(coalesce(s.shop_name, '')), v_q) > 0
    )
  order by d.requested_at desc, d.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Realtime: tài khoản + shop (mỗi người chỉ nhận dòng của mình nhờ RLS)
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Không có publication supabase_realtime — bỏ qua bật Realtime.';
    return;
  end if;
  foreach v_table in array array['profiles', 'sellers'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Quyền gọi hàm (mặc định mọi hàm mới đều cấp cho PUBLIC → thu hồi rồi cấp đúng)
-- -----------------------------------------------------------------------------
revoke execute on function public.request_account_deletion(uuid, text, jsonb) from public, anon;
revoke execute on function public.confirm_account_deletion(uuid) from public, anon;
revoke execute on function public.restore_account(uuid, text) from public, anon;
revoke execute on function public.set_account_locked(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_deletion_notice(uuid) from public, anon;
revoke execute on function public.mark_deletion_notified(uuid, text) from public, anon;
revoke execute on function public.admin_list_accounts(text, public.user_role, boolean, public.seller_status, int, int, public.account_status) from public, anon;
revoke execute on function public.admin_platform_stats(int) from public, anon;
revoke execute on function public.admin_revenue_series(int) from public, anon;
revoke execute on function public.admin_list_sellers(text, public.seller_status, int, int) from public, anon;
revoke execute on function public.admin_get_seller(uuid) from public, anon;
revoke execute on function public.admin_list_audit_logs(uuid, text, date, date, uuid[], int, int) from public, anon;
revoke execute on function public.admin_list_account_deletions(public.account_deletion_status, text, int, int) from public, anon;

grant execute on function public.request_account_deletion(uuid, text, jsonb) to authenticated;
grant execute on function public.confirm_account_deletion(uuid) to authenticated;
grant execute on function public.restore_account(uuid, text) to authenticated;
grant execute on function public.set_account_locked(uuid, boolean, text) to authenticated;
grant execute on function public.admin_deletion_notice(uuid) to authenticated;
grant execute on function public.mark_deletion_notified(uuid, text) to authenticated;
grant execute on function public.admin_list_accounts(text, public.user_role, boolean, public.seller_status, int, int, public.account_status) to authenticated;
grant execute on function public.admin_platform_stats(int) to authenticated;
grant execute on function public.admin_revenue_series(int) to authenticated;
grant execute on function public.admin_list_sellers(text, public.seller_status, int, int) to authenticated;
grant execute on function public.admin_get_seller(uuid) to authenticated;
grant execute on function public.admin_list_audit_logs(uuid, text, date, date, uuid[], int, int) to authenticated;
grant execute on function public.admin_list_account_deletions(public.account_deletion_status, text, int, int) to authenticated;
