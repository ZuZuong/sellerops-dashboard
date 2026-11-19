-- =============================================================================
-- "Xác nhận xóa" = XÓA HẲN TÀI KHOẢN ĐĂNG NHẬP, GIỮ TOÀN BỘ THÔNG TIN.
--
--   active ──xóa──► pending_deletion (thùng rác, giữ vô thời hạn, khôi phục được)
--                         │
--                         └──xác nhận xóa──► tài khoản auth.users bị xóa (email được giải phóng,
--                                            mọi phiên đăng nhập bị hủy, KHÔNG khôi phục được)
--
-- Sau khi xóa hẳn tài khoản:
--  * Shop và MỌI dữ liệu kinh doanh (sản phẩm, đơn hàng, phiếu nhập, kho, giấy tờ, file) được giữ
--    nguyên; shop chuyển sang "không có chủ" (owner_id = null) và lưu email / họ tên / id chủ cũ
--    dạng chữ. Không ai đăng nhập vào shop đó được nữa; admin vẫn xem được (chỉ đọc).
--  * Hồ sơ xóa (account_deletions) + nhật ký (audit_logs) giữ email, họ tên, tên shop dạng chữ.
--  * Người đó có thể đăng ký lại bằng email cũ → tài khoản MỚI, không liên quan dữ liệu cũ.
--
-- Mã lỗi: DELETION_NOT_RESTORABLE (chỉ khôi phục được khi còn trong thùng rác).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Shop không bị xóa theo tài khoản
-- -----------------------------------------------------------------------------
alter table public.sellers
  alter column owner_id drop not null,
  add column former_owner_id    uuid,
  add column former_owner_email text,
  add column former_owner_name  text,
  add column owner_removed_at   timestamptz,
  add constraint sellers_owner_or_former check (owner_id is not null or former_owner_id is not null);

alter table public.sellers drop constraint sellers_owner_id_fkey;
alter table public.sellers
  add constraint sellers_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

-- Chủ shop không đổi được — ngoại lệ duy nhất: khóa ngoại tự đặt null khi tài khoản bị xóa hẳn.
create or replace function public.enforce_seller_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
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

-- -----------------------------------------------------------------------------
-- 2. Hồ sơ xóa giữ thông tin tài khoản dạng chữ
-- -----------------------------------------------------------------------------
alter table public.account_deletions
  add column former_user_id uuid,
  add column email          text,
  add column full_name      text,
  add column shop_name      text;

update public.account_deletions d set
  former_user_id = d.user_id,
  email = (select u.email::text from auth.users u where u.id = d.user_id),
  full_name = (select p.full_name from public.profiles p where p.id = d.user_id),
  shop_name = (select s.shop_name from public.sellers s where s.id = d.seller_id);

alter table public.account_deletions
  alter column former_user_id set not null,
  alter column user_id drop not null;

alter table public.account_deletions drop constraint account_deletions_user_id_fkey;
alter table public.account_deletions
  add constraint account_deletions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

create index account_deletions_former_user_idx on public.account_deletions (former_user_id);

-- Hồ sơ đã "xác nhận" theo cách cũ (chỉ đổi trạng thái, tài khoản vẫn còn) → trả về thùng rác để
-- admin xác nhận lại theo cách mới (xóa hẳn tài khoản).
update public.account_deletions
set status = 'pending', confirmed_by = null, confirmed_at = null
where status = 'confirmed' and user_id is not null;

update public.profiles set account_status = 'pending_deletion' where account_status = 'deleted';

-- -----------------------------------------------------------------------------
-- 3. RPC
-- -----------------------------------------------------------------------------

-- Ghi thêm thông tin dạng chữ ngay lúc đưa vào thùng rác.
create or replace function public.request_account_deletion(
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
  v_shop     text;
  v_email    text;
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

  select s.id, s.shop_name into v_seller, v_shop from public.sellers s where s.owner_id = p_user_id;
  select u.email::text into v_email from auth.users u where u.id = p_user_id;

  insert into public.account_deletions (
    user_id, former_user_id, email, full_name, seller_id, shop_name, reason, requested_by,
    previous_locked, previous_locked_reason, previous_locked_at
  )
  values (
    p_user_id, p_user_id, v_email, p.full_name, v_seller, v_shop, v_reason, auth.uid(),
    p.is_locked, p.locked_reason, p.locked_at
  )
  returning id into v_id;

  for v_item in select x.value from jsonb_array_elements(v_evidence) as x(value) loop
    v_path := v_item ->> 'storage_path';
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
      'seller_id', v_seller,
      'email', v_email,
      'shop_name', v_shop
    )
  );
  return v_id;
end $$;

-- Xác nhận xóa: XÓA HẲN tài khoản đăng nhập, giữ shop + mọi dữ liệu. Không khôi phục được.
create or replace function public.confirm_account_deletion(p_deletion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d       public.account_deletions%rowtype;
  v_email text;
  v_name  text;
  v_shop  text;
begin
  perform public.require_admin();

  select * into d from public.account_deletions where id = p_deletion_id for update;
  if d.id is null then
    raise exception 'DELETION_NOT_FOUND';
  end if;
  if d.status <> 'pending' or d.user_id is null then
    raise exception 'DELETION_NOT_PENDING' using detail = d.status::text;
  end if;

  select u.email::text into v_email from auth.users u where u.id = d.user_id;
  select p.full_name into v_name from public.profiles p where p.id = d.user_id;
  select s.shop_name into v_shop from public.sellers s where s.owner_id = d.user_id;

  -- Lưu thông tin chủ shop dạng chữ TRƯỚC khi tài khoản biến mất.
  update public.sellers set
    former_owner_id = d.user_id,
    former_owner_email = coalesce(v_email, d.email),
    former_owner_name = coalesce(v_name, d.full_name),
    owner_removed_at = now()
  where owner_id = d.user_id;

  update public.account_deletions set
    status = 'confirmed',
    confirmed_by = auth.uid(),
    confirmed_at = now(),
    email = coalesce(v_email, email),
    full_name = coalesce(v_name, full_name),
    shop_name = coalesce(v_shop, shop_name)
  where id = p_deletion_id;

  perform public.log_audit(
    'account.deletion_confirmed', 'account', d.user_id,
    jsonb_build_object(
      'deletion_id', d.id,
      'email', coalesce(v_email, d.email),
      'shop_name', coalesce(v_shop, d.shop_name)
    )
  );

  -- Xóa tài khoản đăng nhập: auth.identities / sessions / refresh_tokens và profiles bị xóa theo;
  -- sellers.owner_id và account_deletions.user_id tự chuyển null (dữ liệu shop giữ nguyên).
  delete from auth.users where id = d.user_id;
end $$;

-- Khôi phục: chỉ khi tài khoản còn trong thùng rác (đã xóa hẳn thì không còn gì để khôi phục).
create or replace function public.restore_account(p_deletion_id uuid, p_note text default null)
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
  if d.status <> 'pending' or d.user_id is null then
    raise exception 'DELETION_NOT_RESTORABLE' using detail = d.status::text;
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
    jsonb_build_object('deletion_id', d.id, 'note', v_note)
  );
end $$;

create or replace function public.admin_deletion_notice(p_deletion_id uuid)
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
    coalesce(u.email::text, d.email),
    coalesce(p.full_name, d.full_name),
    coalesce(s.shop_name, d.shop_name),
    d.reason,
    d.requested_at,
    (select count(*) from public.account_deletion_evidence e where e.deletion_id = d.id)::int
  from public.account_deletions d
  left join auth.users u on u.id = d.user_id
  left join public.profiles p on p.id = d.user_id
  left join public.sellers s on s.id = d.seller_id
  where d.id = p_deletion_id;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Danh sách cho admin: shop / hồ sơ của tài khoản đã xóa hẳn vẫn hiển thị (left join +
--    thông tin dạng chữ). account_status của chủ shop đã xóa hẳn hiển thị là 'deleted'.
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_sellers(
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
    coalesce(s.owner_id, s.former_owner_id),
    coalesce(u.email::text, s.former_owner_email),
    coalesce(p.account_status, 'deleted'::public.account_status),
    coalesce(p.is_locked, true),
    s.submitted_at,
    s.reviewed_at,
    s.created_at,
    (select count(*) from public.products pr where pr.seller_id = s.id)::int,
    (select count(*) from public.orders o where o.seller_id = s.id and o.status <> 'cancelled')::int,
    coalesce((select sum(o.total) from public.orders o
              where o.seller_id = s.id and o.status in ('confirmed', 'shipping', 'delivered')), 0)::numeric,
    count(*) over ()
  from public.sellers s
  left join public.profiles p on p.id = s.owner_id
  left join auth.users u on u.id = s.owner_id
  where (p_status is null or s.status = p_status)
    and (
      v_q = ''
      or strpos(lower(coalesce(s.shop_name, '')), v_q) > 0
      or strpos(lower(coalesce(s.business_name, '')), v_q) > 0
      or strpos(lower(coalesce(u.email, s.former_owner_email, '')), v_q) > 0
      or strpos(lower(coalesce(s.tax_code, '')), v_q) > 0
    )
  order by
    case when p_status = 'pending' then s.submitted_at end asc nulls last,
    s.created_at desc,
    s.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.admin_get_seller(p_seller_id uuid)
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
    s.id,
    coalesce(s.owner_id, s.former_owner_id),
    coalesce(u.email::text, s.former_owner_email),
    coalesce(p.full_name, s.former_owner_name),
    coalesce(p.account_status, 'deleted'::public.account_status),
    coalesce(p.is_locked, true),
    case
      when s.owner_id is null then 'Tài khoản chủ shop đã bị xóa vĩnh viễn ngày '
        || to_char(s.owner_removed_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')
      else p.locked_reason
    end,
    s.status, s.shop_name, s.slug, s.business_type, s.business_name, s.tax_code,
    s.license_number, s.address, s.representative_name, s.representative_phone,
    s.contact_email, s.main_category, s.terms_version, s.terms_accepted_at, s.submitted_at,
    s.reviewed_at, r.email::text, s.rejection_reason, s.suspended_reason, s.created_at
  from public.sellers s
  left join public.profiles p on p.id = s.owner_id
  left join auth.users u on u.id = s.owner_id
  left join auth.users r on r.id = s.reviewed_by
  where s.id = p_seller_id;
end $$;

create or replace function public.admin_list_account_deletions(
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
    d.former_user_id,
    coalesce(u.email::text, d.email),
    coalesce(p.full_name, d.full_name),
    coalesce(p.role, case when d.seller_id is not null then 'seller' else 'customer' end::public.user_role),
    d.seller_id,
    coalesce(s.shop_name, d.shop_name),
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
  left join auth.users u on u.id = d.user_id
  left join public.profiles p on p.id = d.user_id
  left join public.sellers s on s.id = d.seller_id
  left join auth.users rb on rb.id = d.requested_by
  where (p_status is null or d.status = p_status)
    and (
      v_q = ''
      or strpos(lower(coalesce(u.email, d.email, '')), v_q) > 0
      or strpos(lower(coalesce(s.shop_name, d.shop_name, '')), v_q) > 0
    )
  order by d.requested_at desc, d.id
  limit v_size offset (v_page - 1) * v_size;
end $$;

-- Nhật ký: tài khoản đã xóa hẳn vẫn hiển thị email (lấy từ hồ sơ xóa).
create or replace function public.admin_list_audit_logs(
  p_actor_id   uuid default null,
  p_action     text default null,
  p_from       date default null,
  p_to         date default null,
  p_target_ids uuid[] default null,
  p_page       int default 1,
  p_page_size  int default 20
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
      when 'account' then coalesce(
        (select t.email::text from auth.users t where t.id = a.target_id),
        (select d.email from public.account_deletions d
         where d.former_user_id = a.target_id and d.email is not null
         order by d.requested_at desc limit 1),
        a.metadata ->> 'email'
      )
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

-- `create or replace` giữ nguyên quyền đã cấp; cấp lại cho chắc chắn khi chạy trên môi trường mới.
revoke execute on function public.request_account_deletion(uuid, text, jsonb) from public, anon;
revoke execute on function public.confirm_account_deletion(uuid) from public, anon;
revoke execute on function public.restore_account(uuid, text) from public, anon;
grant execute on function public.request_account_deletion(uuid, text, jsonb) to authenticated;
grant execute on function public.confirm_account_deletion(uuid) to authenticated;
grant execute on function public.restore_account(uuid, text) to authenticated;
