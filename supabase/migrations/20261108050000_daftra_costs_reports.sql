-- Owner request (Phase 4): Sales reports show cost of goods and gross profit without opening the
-- ERP. In Daftra mode each sold line's cost is the Daftra product cost, saved once the Daftra bill
-- is issued (cost at the time of sale). Costs stay private: only the service role writes them and
-- reports show totals to staff with the Analysis permission.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table private.order_item_costs (
 order_item_id uuid primary key references public.customer_order_items(id) on delete cascade,
 order_id uuid not null references public.customer_orders(id) on delete cascade,
 source text not null check (source='daftra'),
 external_product_id text not null check (external_product_id ~ '^[1-9][0-9]{0,18}$'),
 unit_cost numeric(12,2) not null check (unit_cost>=0),
 captured_at timestamptz not null default clock_timestamp()
);
create index order_item_costs_order_idx on private.order_item_costs(order_id);
alter table private.order_item_costs enable row level security;
revoke all on table private.order_item_costs from public,anon,authenticated;

-- Order lines that already have a saved cost.
create function public.order_item_costs_known(p_order uuid) returns uuid[]
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 return coalesce((select array_agg(c.order_item_id) from private.order_item_costs c where c.order_id=p_order),'{}');
end $$;

create function public.order_item_costs_save(p_order uuid,p_rows jsonb) returns integer
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare r jsonb; saved integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 100 then
  raise exception 'Send between 1 and 100 order lines.' using errcode='22023';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r)<>'object' or coalesce(r->>'order_item_id','') !~ '^[0-9a-fA-F-]{36}$'
   or not exists(select 1 from public.customer_order_items i where i.id=(r->>'order_item_id')::uuid and i.order_id=p_order) then
   raise exception 'Unknown order line.' using errcode='22023';end if;
  insert into private.order_item_costs(order_item_id,order_id,source,external_product_id,unit_cost)
  values((r->>'order_item_id')::uuid,p_order,'daftra',r->>'external_product_id',round((r->>'unit_cost')::numeric,2))
  on conflict(order_item_id) do update set external_product_id=excluded.external_product_id,unit_cost=excluded.unit_cost,captured_at=clock_timestamp();
  saved:=saved+1;
 end loop;
 return saved;
end $$;

revoke all on function public.order_item_costs_known(uuid),public.order_item_costs_save(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.order_item_costs_known(uuid),public.order_item_costs_save(uuid,jsonb) to service_role;

-- Cost of goods and gross profit per day or month, from website orders (not cancelled or
-- refunded). Profit counts only orders whose every line has a cost; the coverage is returned.
-- Product sales = line totals minus the coupon discount (delivery discounts excluded).
create function public.dashboard_get_analysis_profit(p_start_date date,p_end_date date,p_bucket text default 'day')
returns table(period_start date,orders bigint,costed_orders bigint,product_sales numeric,cost numeric,profit numeric)
language plpgsql stable security definer set search_path='' as $$
declare v_bucket text:=case when lower(coalesce(p_bucket,'day'))='month' then 'month' else 'day' end; s timestamptz; e timestamptz;
begin
 if not public.has_admin_permission('dashboard.analysis') then raise exception 'Not authorized';end if;
 if p_start_date is null or p_end_date is null then raise exception 'Start and end dates are required.';end if;
 if p_end_date<p_start_date then raise exception 'End date must be on or after the start date.';end if;
 if (p_end_date-p_start_date)>1095 then raise exception 'Analysis date ranges cannot exceed three years.';end if;
 s:=p_start_date::timestamp at time zone 'Africa/Cairo';
 e:=(p_end_date+1)::timestamp at time zone 'Africa/Cairo';
 return query
 with buckets as (
  select g::date d from generate_series(
   case when v_bucket='month' then date_trunc('month',p_start_date::timestamp) else p_start_date::timestamp end,
   case when v_bucket='month' then date_trunc('month',p_end_date::timestamp) else p_end_date::timestamp end,
   case when v_bucket='month' then interval '1 month' else interval '1 day' end) g
 ), per_order as (
  select case when v_bucket='month' then date_trunc('month',o.created_at at time zone 'Africa/Cairo')::date
    else (o.created_at at time zone 'Africa/Cairo')::date end d,
   sum(i.line_total)-greatest(coalesce(o.discount_amount,0)-coalesce(o.delivery_discount_amount,0),0) sales,
   sum(c.unit_cost*i.quantity) line_cost,
   count(*) lines, count(c.order_item_id) costed_lines
  from public.customer_orders o
  join public.customer_order_items i on i.order_id=o.id
  left join private.order_item_costs c on c.order_item_id=i.id
  where o.created_at>=s and o.created_at<e and o.status not in ('cancelled','refunded')
  group by o.id,1
 ), per_bucket as (
  select p.d,count(*)::bigint n,count(*) filter (where p.costed_lines=p.lines)::bigint known,
   coalesce(sum(p.sales) filter (where p.costed_lines=p.lines),0)::numeric sales,
   coalesce(sum(p.line_cost) filter (where p.costed_lines=p.lines),0)::numeric line_cost
  from per_order p group by p.d
 )
 select b.d,coalesce(x.n,0)::bigint,coalesce(x.known,0)::bigint,round(coalesce(x.sales,0),2),round(coalesce(x.line_cost,0),2),
  round(coalesce(x.sales,0)-coalesce(x.line_cost,0),2)
 from buckets b left join per_bucket x on x.d=b.d order by b.d;
end $$;
revoke all on function public.dashboard_get_analysis_profit(date,date,text) from public,anon;
grant execute on function public.dashboard_get_analysis_profit(date,date,text) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
