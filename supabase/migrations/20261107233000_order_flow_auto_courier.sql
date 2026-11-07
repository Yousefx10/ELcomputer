-- Owner request 7 Nov 2026 (phase 2B): "if order is paid > PDC AWB is confirmed and Daftra
-- bill is ready. No need to review first." Dashboard → Settings → Order flow chooses, per
-- order type, Automatic or Review first (the current flow). Automatic skips only the
-- "ready to deliver + packing video" step; payment, courier, address, city and PDC checks
-- stay. Only orders placed after the switch is turned on are booked automatically.
-- A definitive PDC rejection (nothing created) now keeps PDC's reason and frees the order
-- for a corrected booking or a portal AWB. Uncertain outcomes still never rebook.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table public.commerce_order_flow_settings(
 id text primary key default 'default' check(id='default'),
 paid_orders text not null default 'review' check(paid_orders in ('review','auto')),
 cod_orders text not null default 'review' check(cod_orders in ('review','auto')),
 parcel_weight_kg numeric(8,3) not null default 1.000 check(parcel_weight_kg between 0.001 and 99999.999),
 acting_admin_id uuid,
 paid_auto_since timestamptz,
 cod_auto_since timestamptz,
 updated_by uuid,
 updated_at timestamptz not null default clock_timestamp(),
 constraint commerce_order_flow_actor check((paid_orders='review' and cod_orders='review') or acting_admin_id is not null),
 constraint commerce_order_flow_paid_since check(paid_orders='review' or paid_auto_since is not null),
 constraint commerce_order_flow_cod_since check(cod_orders='review' or cod_auto_since is not null)
);
insert into public.commerce_order_flow_settings(id) values('default');
alter table public.commerce_order_flow_settings enable row level security;
revoke all on public.commerce_order_flow_settings from public,anon,authenticated;
grant select on public.commerce_order_flow_settings to service_role;

-- True only when this order's type is set to Automatic by an active order manager.
create function private.order_flow_auto(o public.customer_orders) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select not coalesce(o.is_preorder,false) and o.status in ('processing','ready_to_deliver')
   and exists(select 1 from public.admin_users a where a.id=f.acting_admin_id and a.is_active
    and (a.role='owner' or coalesce((a.permissions->>'dashboard.orders')::boolean,false)))
   and case when o.payment_method='cash' then f.cod_orders='auto' and o.created_at>=f.cod_auto_since
    else f.paid_orders='auto' and o.payment_status='paid' and o.amount_paid=o.total_amount
     and coalesce(o.paid_at,o.created_at)>=f.paid_auto_since end
  from public.commerce_order_flow_settings f where f.id='default'),false)
$$;

-- Automatic orders skip only the ready-to-deliver status and the packing video evidence.
do $$
declare d text:=pg_get_functiondef('private.pdc_order_eligibility(uuid)'::regprocedure);
 a1 text:='if not found or o.status<>''ready_to_deliver'' or o.shipping_review_status';
 a2 text:=' if not exists(select 1 from public.order_packing_sessions p join public.order_packing_videos v on v.packing_session_id=p.id';
begin
 if (length(d)-length(replace(d,a1,'')))/length(a1)<>1 or (length(d)-length(replace(d,a2,'')))/length(a2)<>1 then
  raise exception 'Courier eligibility anchors changed.';
 end if;
 d:=replace(d,a1,'if not found or (o.status<>''ready_to_deliver'' and not private.order_flow_auto(o)) or o.shipping_review_status');
 d:=replace(d,a2,' if not private.order_flow_auto(o) and not exists(select 1 from public.order_packing_sessions p join public.order_packing_videos v on v.packing_session_id=p.id');
 execute d;
end $$;

create function public.shipping_order_prepare_auto(p_order uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.commerce_order_flow_settings%rowtype; o public.customer_orders%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
 select * into f from public.commerce_order_flow_settings where id='default';
 select * into o from public.customer_orders where id=p_order for update;
 if not found or not private.order_flow_auto(o) then raise exception 'Automatic courier booking is off for this order.'; end if;
 return public.shipping_order_prepare_measured(f.acting_admin_id,p_order,f.parcel_weight_kg);
end $$;

create table private.order_auto_courier_attempts(
 order_id uuid primary key references public.customer_orders(id) on delete cascade,
 attempts integer not null default 1,
 last_error text not null,
 next_at timestamptz not null,
 updated_at timestamptz not null default clock_timestamp()
);
alter table private.order_auto_courier_attempts enable row level security;
revoke all on private.order_auto_courier_attempts from public,anon,authenticated,service_role;

create function public.orders_due_for_auto_courier(p_limit integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(id) from (select o.id from public.customer_orders o
  where o.status in ('processing','ready_to_deliver') and o.created_at>clock_timestamp()-interval '14 days'
   and private.order_flow_auto(o)
   and not exists(select 1 from public.shipping_order_jobs j where j.order_id=o.id)
   and not exists(select 1 from private.pdc_dispatches d where d.order_id=o.id)
   and not exists(select 1 from private.order_auto_courier_attempts a where a.order_id=o.id and (a.next_at>clock_timestamp() or a.attempts>=8))
  order by o.created_at limit least(greatest(coalesce(p_limit,1),1),5)) due),'[]'::jsonb);
end $$;

-- Waiting orders retry later with growing gaps; success clears the note.
create function public.order_auto_courier_record(p_order uuid,p_error text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
 if p_error is null then delete from private.order_auto_courier_attempts where order_id=p_order; return; end if;
 insert into private.order_auto_courier_attempts(order_id,last_error,next_at) values(p_order,left(p_error,300),clock_timestamp()+interval '15 minutes')
 on conflict(order_id) do update set attempts=private.order_auto_courier_attempts.attempts+1,last_error=excluded.last_error,
  next_at=clock_timestamp()+make_interval(mins=>least(15*(private.order_auto_courier_attempts.attempts+1),240)),updated_at=clock_timestamp();
end $$;

create function public.order_auto_courier_waiting() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('orderId',o.id,'orderNumber',o.order_number,'attempts',a.attempts,'error',a.last_error,'nextAt',a.next_at) order by a.updated_at desc)
  from private.order_auto_courier_attempts a join public.customer_orders o on o.id=a.order_id
  where o.status in ('processing','ready_to_deliver') and not exists(select 1 from public.shipping_order_jobs j where j.order_id=o.id)),'[]'::jsonb);
end $$;

create function public.order_flow_save(p_admin uuid,p_paid text,p_cod text,p_weight numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.commerce_order_flow_settings%rowtype;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_admin and is_active
  and (role='owner' or (coalesce((permissions->>'settings.edit')::boolean,false) and coalesce((permissions->>'dashboard.orders')::boolean,false)))) then
  raise exception 'Order flow permission is required.' using errcode='42501';
 end if;
 if p_paid not in ('review','auto') or p_cod not in ('review','auto') or p_weight is null or p_weight not between 0.001 and 99999.999 or p_weight<>trunc(p_weight,3) then
  raise exception 'Choose a valid order flow and parcel weight.' using errcode='22023';
 end if;
 select * into f from public.commerce_order_flow_settings where id='default' for update;
 update public.commerce_order_flow_settings set paid_orders=p_paid,cod_orders=p_cod,parcel_weight_kg=p_weight,
  acting_admin_id=case when p_paid='auto' or p_cod='auto' then p_admin else acting_admin_id end,
  paid_auto_since=case when p_paid<>'auto' then null when f.paid_orders='auto' then f.paid_auto_since else clock_timestamp() end,
  cod_auto_since=case when p_cod<>'auto' then null when f.cod_orders='auto' then f.cod_auto_since else clock_timestamp() end,
  updated_by=p_admin,updated_at=clock_timestamp() where id='default' returning * into f;
 return to_jsonb(f);
end $$;

-- PDC confirmed nothing was created: keep the reason and free the order for a corrected booking.
create table private.pdc_rejections(
 id bigint generated always as identity primary key,
 order_id uuid not null, job_id uuid not null, to_ref text not null, reason text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.pdc_rejections enable row level security;
revoke all on private.pdc_rejections from public,anon,authenticated,service_role;

create function public.shipping_order_reject(p_job uuid,p_token uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.shipping_order_jobs%rowtype; reason text:=left(coalesce(nullif(btrim(p_reason),''),'No reason given.'),200);
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501'; end if;
 perform 1 from public.customer_orders where id=(select order_id from public.shipping_order_jobs where id=p_job) for update;
 select * into j from public.shipping_order_jobs where id=p_job for update;
 if not found or p_token is null or j.work_token is distinct from p_token or j.awb is not null or j.state<>'submitting' then raise exception 'Courier lease changed.'; end if;
 insert into private.pdc_rejections(order_id,job_id,to_ref,reason) values(j.order_id,j.id,j.to_ref,reason);
 delete from private.pdc_dispatches where order_id=j.order_id and job_id=j.id and state='dispatched' and awb is null;
 update public.shipping_order_jobs set state='failed',work_token=null,lease_until=null,dispatch_started_at=null,attempt_count=0,
  request_payload='{}'::jsonb,last_error='PDC rejected the booking: '||reason,next_attempt_at=null,updated_at=clock_timestamp() where id=j.id;
 return jsonb_build_object('id',j.id,'state','failed');
end $$;

revoke all on function private.order_flow_auto(public.customer_orders),public.shipping_order_prepare_auto(uuid),public.orders_due_for_auto_courier(integer),
 public.order_auto_courier_record(uuid,text),public.order_auto_courier_waiting(),public.order_flow_save(uuid,text,text,numeric),
 public.shipping_order_reject(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.shipping_order_prepare_auto(uuid),public.orders_due_for_auto_courier(integer),public.order_auto_courier_record(uuid,text),
 public.order_auto_courier_waiting(),public.order_flow_save(uuid,text,text,numeric),public.shipping_order_reject(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
