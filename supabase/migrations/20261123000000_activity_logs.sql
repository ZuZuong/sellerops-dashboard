-- =============================================================================
-- Nhật ký hoạt động / thông báo (chuông thông báo trên header).
--
--  * Mỗi thông báo app hiển thị (tạo đơn, xác nhận, nhập kho, lỗi...) được ghi một dòng: tiêu đề,
--    nội dung, mức độ, trang đang đứng, thời điểm. Đồng bộ giữa các thiết bị của cùng tài khoản.
--  * read_at null = chưa xem → đếm số trên chuông. Mở chuông → đánh dấu đã xem tất cả.
--  * Giữ tối đa 500 dòng mới nhất mỗi tài khoản (trigger dọn bớt dòng cũ).
-- =============================================================================

create table public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level      text not null check (level in ('success', 'error', 'warning', 'info')),
  title      text not null check (length(title) between 1 and 200),
  message    text check (message is null or length(message) <= 1000),
  path       text check (path is null or length(path) <= 300),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_user_unread_idx on public.activity_logs (user_id) where read_at is null;

alter table public.activity_logs enable row level security;

create policy "activity_logs: select own" on public.activity_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "activity_logs: insert own" on public.activity_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "activity_logs: update own" on public.activity_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "activity_logs: delete own" on public.activity_logs
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.activity_logs from anon;
-- Client chỉ ghi nội dung thông báo; chỉ được sửa mốc "đã xem".
revoke insert, update on public.activity_logs from authenticated;
grant insert (level, title, message, path) on public.activity_logs to authenticated;
grant update (read_at) on public.activity_logs to authenticated;

create function public.trim_activity_logs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_logs a
  where a.user_id = new.user_id
    and a.id in (
      select l.id from public.activity_logs l
      where l.user_id = new.user_id
      order by l.created_at desc, l.id desc
      offset 500
    );
  return null;
end $$;

revoke execute on function public.trim_activity_logs() from public, anon, authenticated;

create trigger activity_logs_trim
  after insert on public.activity_logs
  for each row execute function public.trim_activity_logs();
