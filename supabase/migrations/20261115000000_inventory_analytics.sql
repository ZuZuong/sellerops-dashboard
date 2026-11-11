-- =============================================================================
-- SellerOps – Inventory & Analytics
--   * get_inventory_summary: số liệu tổng quan kho (số SP, sắp hết, hết hàng, tổng tồn, giá trị tồn).
--   * Báo cáo doanh thu theo khoảng ngày tùy chọn [p_from, p_to] (tính cả hai đầu, theo ngày lịch
--     của múi giờ cửa hàng). Kỳ trước = khoảng liền trước có cùng số ngày (để so sánh).
--   * Doanh thu ghi nhận khi đơn đã xác nhận: status in (confirmed, shipping, delivered);
--     dùng unit_price đã chốt trong order_items, không đọc lại giá hiện tại.
--   * SECURITY INVOKER: RLS áp dụng như truy vấn thường.
-- Mã lỗi: INVALID_RANGE (thiếu ngày, from > to, hoặc dài hơn 366 ngày)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Kho
-- -----------------------------------------------------------------------------
create function public.get_inventory_summary()
returns table (
  product_count      int,
  low_stock_count    int,
  out_of_stock_count int,
  total_units        bigint,
  stock_value        numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::int,
    (count(*) filter (where p.stock > 0 and p.stock <= p.low_stock_threshold))::int,
    (count(*) filter (where p.stock = 0))::int,
    coalesce(sum(p.stock), 0)::bigint,
    coalesce(sum(p.stock * p.price), 0)::numeric
  from public.products p
  where p.is_active;
$$;

-- -----------------------------------------------------------------------------
-- Analytics: khoảng ngày → mốc thời gian
-- -----------------------------------------------------------------------------

-- Kiểm tra khoảng ngày và trả về mốc [start, end) theo múi giờ p_tz.
create function public.report_bounds(p_from date, p_to date, p_tz text)
returns table (range_start timestamptz, range_end timestamptz, prev_start timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_days int;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from + 1 > 366 then
    raise exception 'INVALID_RANGE'
      using detail = coalesce(p_from::text, 'null') || '..' || coalesce(p_to::text, 'null');
  end if;
  v_days := p_to - p_from + 1;
  -- Ép sang timestamp (không tz) trước khi AT TIME ZONE để mốc ngày không lệch theo session.
  range_start := (p_from::timestamp) at time zone p_tz;
  range_end := ((p_to + 1)::timestamp) at time zone p_tz;
  prev_start := ((p_from - v_days)::timestamp) at time zone p_tz;
  return next;
end $$;

-- Tổng quan kỳ hiện tại + kỳ trước.
create function public.get_sales_summary(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (
  revenue              numeric,
  order_count          int,
  items_sold           int,
  cancelled_count      int,
  prev_revenue         numeric,
  prev_order_count     int,
  prev_items_sold      int,
  prev_cancelled_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  o as (
    select
      ord.id,
      ord.status,
      ord.total,
      ord.created_at >= b.range_start as is_current,
      ord.status in ('confirmed', 'shipping', 'delivered') as is_sale
    from public.orders ord, b
    where ord.created_at >= b.prev_start and ord.created_at < b.range_end
  ),
  items as (
    select o.is_current, sum(i.quantity) as qty
    from o
    join public.order_items i on i.order_id = o.id
    where o.is_sale
    group by o.is_current
  )
  select
    coalesce((select sum(total) from o where is_current and is_sale), 0)::numeric,
    (select count(*) from o where is_current and is_sale)::int,
    coalesce((select qty from items where is_current), 0)::int,
    (select count(*) from o where is_current and status = 'cancelled')::int,
    coalesce((select sum(total) from o where not is_current and is_sale), 0)::numeric,
    (select count(*) from o where not is_current and is_sale)::int,
    coalesce((select qty from items where not is_current), 0)::int,
    (select count(*) from o where not is_current and status = 'cancelled')::int;
$$;

-- Doanh thu theo ngày, đủ mọi ngày trong khoảng (ngày không có đơn = 0).
create function public.get_revenue_by_day(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (day date, revenue numeric, order_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz)),
  days as (
    select generate_series(p_from::timestamp, p_to::timestamp, interval '1 day')::date as day
  ),
  daily as (
    select
      (o.created_at at time zone p_tz)::date as day,
      sum(o.total) as revenue,
      count(*) as order_count
    from public.orders o, b
    where o.created_at >= b.range_start
      and o.created_at < b.range_end
      and o.status in ('confirmed', 'shipping', 'delivered')
    group by 1
  )
  select d.day, coalesce(x.revenue, 0)::numeric, coalesce(x.order_count, 0)::int
  from days d
  left join daily x using (day)
  order by d.day;
$$;

-- Doanh thu theo danh mục (sản phẩm chưa có danh mục gộp vào NULL → client hiển thị "Khác").
create function public.get_revenue_by_category(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
)
returns table (category text, revenue numeric, quantity int)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    nullif(trim(p.category), ''),
    sum(i.quantity * i.unit_price)::numeric,
    sum(i.quantity)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join b
  where o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by 1
  order by 2 desc;
$$;

-- Sản phẩm bán chạy trong khoảng ngày.
create function public.get_top_products_by_range(
  p_from  date,
  p_to    date,
  p_limit int default 10,
  p_tz    text default 'Asia/Ho_Chi_Minh'
)
returns table (product_id uuid, name text, sku text, quantity_sold int, revenue numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (select * from public.report_bounds(p_from, p_to, p_tz))
  select
    p.id,
    p.name,
    p.sku,
    sum(i.quantity)::int,
    sum(i.quantity * i.unit_price)::numeric
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.products p on p.id = i.product_id
  cross join b
  where o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by p.id, p.name, p.sku
  order by sum(i.quantity) desc, sum(i.quantity * i.unit_price) desc, p.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke execute on function public.get_inventory_summary() from public, anon;
revoke execute on function public.report_bounds(date, date, text) from public, anon;
revoke execute on function public.get_sales_summary(date, date, text) from public, anon;
revoke execute on function public.get_revenue_by_day(date, date, text) from public, anon;
revoke execute on function public.get_revenue_by_category(date, date, text) from public, anon;
revoke execute on function public.get_top_products_by_range(date, date, int, text) from public, anon;

-- report_bounds được gọi bên trong function SECURITY INVOKER nên người gọi cần EXECUTE.
grant execute on function public.get_inventory_summary() to authenticated;
grant execute on function public.report_bounds(date, date, text) to authenticated;
grant execute on function public.get_sales_summary(date, date, text) to authenticated;
grant execute on function public.get_revenue_by_day(date, date, text) to authenticated;
grant execute on function public.get_revenue_by_category(date, date, text) to authenticated;
grant execute on function public.get_top_products_by_range(date, date, int, text) to authenticated;
