-- =============================================================================
-- SellerOps – RPC cho trang Tổng quan (dashboard)
-- Nguyên tắc:
--   * Tổng hợp ở Postgres, client chỉ nhận vài dòng kết quả (không kéo toàn bộ đơn về).
--   * SECURITY INVOKER: chạy với quyền người gọi nên RLS vẫn áp dụng như truy vấn thường.
--   * Doanh thu ghi nhận khi đơn đã xác nhận: status in (confirmed, shipping, delivered).
--   * "Ngày" tính theo múi giờ cửa hàng (mặc định Asia/Ho_Chi_Minh), khoảng thời gian gồm
--     p_days ngày lịch gần nhất, tính cả hôm nay.
-- Mã lỗi: INVALID_RANGE
-- =============================================================================

-- Mốc bắt đầu (inclusive) của khoảng p_days ngày gần nhất, theo múi giờ p_tz.
create function public.dashboard_range_start(p_days int, p_tz text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_days is null or p_days < 1 or p_days > 366 then
    raise exception 'INVALID_RANGE' using detail = coalesce(p_days::text, 'null');
  end if;
  -- Ép sang timestamp (không tz) trước khi AT TIME ZONE: nếu để date, Postgres ngầm cast sang
  -- timestamptz theo múi giờ của session và mốc ngày bị lệch.
  return (((now() at time zone p_tz)::date - (p_days - 1))::timestamp) at time zone p_tz;
end $$;

-- KPI: doanh thu & số đơn của kỳ hiện tại và kỳ liền trước (để so sánh),
-- số đơn đang chờ xử lý và số sản phẩm sắp hết hàng (trạng thái hiện tại).
create function public.get_dashboard_kpis(p_days int, p_tz text default 'Asia/Ho_Chi_Minh')
returns table (
  revenue          numeric,
  prev_revenue     numeric,
  order_count      int,
  prev_order_count int,
  pending_count    int,
  low_stock_count  int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      public.dashboard_range_start(p_days, p_tz) as cur_start,
      public.dashboard_range_start(p_days, p_tz) - make_interval(days => p_days) as prev_start
  )
  select
    coalesce(sum(o.total) filter (
      where o.created_at >= b.cur_start and o.status in ('confirmed', 'shipping', 'delivered')
    ), 0)::numeric,
    coalesce(sum(o.total) filter (
      where o.created_at < b.cur_start and o.status in ('confirmed', 'shipping', 'delivered')
    ), 0)::numeric,
    (count(*) filter (where o.created_at >= b.cur_start and o.status <> 'cancelled'))::int,
    (count(*) filter (where o.created_at < b.cur_start and o.status <> 'cancelled'))::int,
    (select count(*) from public.orders p where p.status = 'pending')::int,
    (
      select count(*) from public.products p
      where p.is_active and p.stock <= p.low_stock_threshold
    )::int
  from bounds b
  left join public.orders o on o.created_at >= b.prev_start
  group by b.cur_start;
$$;

-- Chuỗi doanh thu theo ngày, đủ p_days dòng (ngày không có đơn trả về 0).
create function public.get_revenue_series(p_days int, p_tz text default 'Asia/Ho_Chi_Minh')
returns table (day date, revenue numeric, order_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(
      (public.dashboard_range_start(p_days, p_tz) at time zone p_tz)::date::timestamp,
      (now() at time zone p_tz)::date::timestamp,
      interval '1 day'
    )::date as day
  ),
  daily as (
    select
      (o.created_at at time zone p_tz)::date as day,
      sum(o.total) as revenue,
      count(*) as order_count
    from public.orders o
    where o.created_at >= public.dashboard_range_start(p_days, p_tz)
      and o.status in ('confirmed', 'shipping', 'delivered')
    group by 1
  )
  select d.day, coalesce(x.revenue, 0)::numeric, coalesce(x.order_count, 0)::int
  from days d
  left join daily x using (day)
  order by d.day;
$$;

-- Sản phẩm bán chạy theo số lượng trong kỳ (chỉ tính đơn đã xác nhận trở đi).
-- Doanh thu dùng unit_price đã chốt trong order_items, không đọc lại giá hiện tại.
create function public.get_top_products(
  p_days  int,
  p_limit int default 5,
  p_tz    text default 'Asia/Ho_Chi_Minh'
)
returns table (product_id uuid, name text, sku text, quantity_sold int, revenue numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.sku,
    sum(i.quantity)::int,
    sum(i.quantity * i.unit_price)::numeric
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  where o.created_at >= public.dashboard_range_start(p_days, p_tz)
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by p.id, p.name, p.sku
  order by sum(i.quantity) desc, sum(i.quantity * i.unit_price) desc, p.name
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

-- -----------------------------------------------------------------------------
-- Function privileges: function mới mặc định cấp EXECUTE cho public → thu hồi rồi cấp lại.
-- -----------------------------------------------------------------------------
revoke execute on function public.dashboard_range_start(int, text) from public, anon, authenticated;
revoke execute on function public.get_dashboard_kpis(int, text) from public, anon;
revoke execute on function public.get_revenue_series(int, text) from public, anon;
revoke execute on function public.get_top_products(int, int, text) from public, anon;

-- dashboard_range_start được gọi bên trong function SECURITY INVOKER nên người gọi cần EXECUTE.
grant execute on function public.dashboard_range_start(int, text) to authenticated;
grant execute on function public.get_dashboard_kpis(int, text) to authenticated;
grant execute on function public.get_revenue_series(int, text) to authenticated;
grant execute on function public.get_top_products(int, int, text) to authenticated;
