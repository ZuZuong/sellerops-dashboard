-- =============================================================================
-- Bảng kê doanh thu bán hàng (xuất / in từ trang Phân tích).
--
-- Mỗi dòng là một đơn được ghi nhận doanh thu trong khoảng ngày — CÙNG quy tắc với
-- get_sales_summary: đơn đã xác nhận / đang giao / đã giao, theo ngày tạo đơn (giờ Việt Nam).
-- Giá vốn lấy từ order_items.unit_cost (chốt lúc xác nhận đơn).
-- SECURITY INVOKER → RLS trên orders / order_items giới hạn đúng dữ liệu của người gọi.
-- Mã lỗi: INVALID_RANGE (từ report_bounds)
-- =============================================================================

create function public.get_revenue_report(
  p_from date,
  p_to   date,
  p_tz   text default 'Asia/Ho_Chi_Minh'
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
language sql
stable
security invoker
set search_path = ''
as $$
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
  where o.created_at >= b.range_start
    and o.created_at < b.range_end
    and o.status in ('confirmed', 'shipping', 'delivered')
  group by o.id
  order by o.created_at, o.code;
$$;

revoke execute on function public.get_revenue_report(date, date, text) from public, anon;
grant execute on function public.get_revenue_report(date, date, text) to authenticated;
