begin;

create index if not exists customer_orders_created_at_idx
on public.customer_orders (created_at desc);

create index if not exists commerce_sales_orders_created_at_idx
on public.commerce_sales_orders (created_at desc);

create index if not exists commerce_order_returns_created_at_idx
on public.commerce_order_returns (created_at desc);

create index if not exists commerce_inventory_movements_created_at_idx
on public.commerce_inventory_movements (created_at desc);

create or replace function public.dashboard_get_analysis_overview ()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_week_start date;
  v_month_start date;
  v_result jsonb;
begin
  if not public.has_admin_permission ('dashboard.analysis') then
    raise exception 'Not authorized';
  end if;

  v_week_start := date_trunc('week', v_today::timestamp)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;

  with periods as (
    select
      'today'::text as period_key,
      v_today as current_start,
      v_today + 1 as current_end,
      v_today - 1 as previous_start,
      v_today as previous_end
    union all
    select
      'weekly',
      v_week_start,
      v_week_start + 7,
      v_week_start - 7,
      v_week_start
    union all
    select
      'monthly',
      v_month_start,
      (v_month_start + interval '1 month')::date,
      (v_month_start - interval '1 month')::date,
      v_month_start
  ),
  order_events as (
    select
      (orders.created_at at time zone 'Africa/Cairo')::date as event_date,
      orders.total_amount::numeric as amount,
      orders.status not in ('cancelled', 'refunded') as revenue_eligible
    from public.customer_orders as orders

    union all

    select
      (sales.created_at at time zone 'Africa/Cairo')::date,
      sales.total_amount::numeric,
      true
    from public.commerce_sales_orders as sales
  ),
  sales_events as (
    select
      (orders.created_at at time zone 'Africa/Cairo')::date as event_date,
      items.quantity::numeric as units
    from public.customer_order_items as items
    join public.customer_orders as orders
      on orders.id = items.order_id
    where orders.status not in ('cancelled', 'refunded')

    union all

    select
      (sales.created_at at time zone 'Africa/Cairo')::date,
      items.quantity::numeric
    from public.commerce_sales_items as items
    join public.commerce_sales_orders as sales
      on sales.id = items.sales_order_id
  )
  select jsonb_object_agg(
    periods.period_key,
    jsonb_build_object(
      'current', jsonb_build_object(
        'orders', (
          select count(*)
          from order_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
        ),
        'sales', (
          select coalesce(sum(units), 0)
          from sales_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
        ),
        'revenue', (
          select coalesce(sum(amount), 0)
          from order_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
            and revenue_eligible
        )
      ),
      'previous', jsonb_build_object(
        'orders', (
          select count(*)
          from order_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
        ),
        'sales', (
          select coalesce(sum(units), 0)
          from sales_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
        ),
        'revenue', (
          select coalesce(sum(amount), 0)
          from order_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
            and revenue_eligible
        )
      )
    )
  )
  into v_result
  from periods;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.dashboard_get_analysis_chart (
  p_start_date date,
  p_end_date date,
  p_bucket text default 'day'
)
returns table (
  period_start date,
  orders bigint,
  sales numeric,
  return_units numeric,
  coupons bigint,
  stock numeric,
  revenue numeric,
  expenses numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_bucket text := case when lower(coalesce(p_bucket, 'day')) = 'month' then 'month' else 'day' end;
  v_start_timestamp timestamp with time zone;
  v_end_timestamp timestamp with time zone;
begin
  if not public.has_admin_permission ('dashboard.analysis') then
    raise exception 'Not authorized';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be on or after the start date.';
  end if;

  if (p_end_date - p_start_date) > 1095 then
    raise exception 'Analysis date ranges cannot exceed three years.';
  end if;

  v_start_timestamp := p_start_date::timestamp at time zone 'Africa/Cairo';
  v_end_timestamp := (p_end_date + 1)::timestamp at time zone 'Africa/Cairo';

  return query
  with buckets as (
    select generated_bucket::date as bucket_date
    from generate_series(
      case
        when v_bucket = 'month' then date_trunc('month', p_start_date::timestamp)
        else p_start_date::timestamp
      end,
      case
        when v_bucket = 'month' then date_trunc('month', p_end_date::timestamp)
        else p_end_date::timestamp
      end,
      case
        when v_bucket = 'month' then interval '1 month'
        else interval '1 day'
      end
    ) as series(generated_bucket)
  ),
  online_orders as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as order_count,
      coalesce(sum(orders.total_amount) filter (where orders.status not in ('cancelled', 'refunded')), 0)::numeric as revenue_amount
    from public.customer_orders as orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
    group by 1
  ),
  manual_orders as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', sales.created_at at time zone 'Africa/Cairo')::date
        else (sales.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as order_count,
      coalesce(sum(sales.total_amount), 0)::numeric as revenue_amount
    from public.commerce_sales_orders as sales
    where sales.created_at >= v_start_timestamp
      and sales.created_at < v_end_timestamp
    group by 1
  ),
  order_metrics as (
    select
      combined.bucket_date,
      sum(combined.order_count)::bigint as order_count,
      sum(combined.revenue_amount)::numeric as revenue_amount
    from (
      select * from online_orders
      union all
      select * from manual_orders
    ) as combined
    group by combined.bucket_date
  ),
  online_sales as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(items.quantity), 0)::numeric as units
    from public.customer_order_items as items
    join public.customer_orders as orders
      on orders.id = items.order_id
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
      and orders.status not in ('cancelled', 'refunded')
    group by 1
  ),
  manual_sales as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', sales.created_at at time zone 'Africa/Cairo')::date
        else (sales.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(items.quantity), 0)::numeric as units
    from public.commerce_sales_items as items
    join public.commerce_sales_orders as sales
      on sales.id = items.sales_order_id
    where sales.created_at >= v_start_timestamp
      and sales.created_at < v_end_timestamp
    group by 1
  ),
  sales_metrics as (
    select combined.bucket_date, sum(combined.units)::numeric as units
    from (
      select * from online_sales
      union all
      select * from manual_sales
    ) as combined
    group by combined.bucket_date
  ),
  return_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', return_orders.created_at at time zone 'Africa/Cairo')::date
        else (return_orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(return_orders.total_items), 0)::numeric as units
    from public.commerce_order_returns as return_orders
    where return_orders.created_at >= v_start_timestamp
      and return_orders.created_at < v_end_timestamp
    group by 1
  ),
  coupon_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as uses
    from public.customer_orders as orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
      and nullif(trim(orders.coupon_code), '') is not null
    group by 1
  ),
  stock_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', movements.created_at at time zone 'Africa/Cairo')::date
        else (movements.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(movements.quantity_change), 0)::numeric as quantity_change
    from public.commerce_inventory_movements as movements
    where movements.created_at >= v_start_timestamp
      and movements.created_at < v_end_timestamp
    group by 1
  ),
  expense_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', transactions.paid_at::timestamp)::date
        else transactions.paid_at
      end as bucket_date,
      coalesce(sum(transactions.amount), 0)::numeric as amount
    from public.treasury_transactions as transactions
    where transactions.paid_at >= p_start_date
      and transactions.paid_at <= p_end_date
      and transactions.transaction_type in ('supplier_payment', 'salary_payment')
    group by 1
  )
  select
    buckets.bucket_date,
    coalesce(order_metrics.order_count, 0)::bigint,
    coalesce(sales_metrics.units, 0)::numeric,
    coalesce(return_metrics.units, 0)::numeric,
    coalesce(coupon_metrics.uses, 0)::bigint,
    coalesce(stock_metrics.quantity_change, 0)::numeric,
    coalesce(order_metrics.revenue_amount, 0)::numeric,
    coalesce(expense_metrics.amount, 0)::numeric
  from buckets
  left join order_metrics on order_metrics.bucket_date = buckets.bucket_date
  left join sales_metrics on sales_metrics.bucket_date = buckets.bucket_date
  left join return_metrics on return_metrics.bucket_date = buckets.bucket_date
  left join coupon_metrics on coupon_metrics.bucket_date = buckets.bucket_date
  left join stock_metrics on stock_metrics.bucket_date = buckets.bucket_date
  left join expense_metrics on expense_metrics.bucket_date = buckets.bucket_date
  order by buckets.bucket_date;
end;
$$;

revoke all on function public.dashboard_get_analysis_overview () from public;
revoke all on function public.dashboard_get_analysis_chart (date, date, text) from public;

grant execute on function public.dashboard_get_analysis_overview () to authenticated;
grant execute on function public.dashboard_get_analysis_chart (date, date, text) to authenticated;

commit;
