-- 106: measured per-order weight; staff-controlled Manual/PDC CARD and COD.
-- No historical row rewrite, provider activation, booking or financial change.
begin;
set local lock_timeout='5s';

alter table public.shipping_order_jobs add column actual_weight_kg numeric(8,3),
 add constraint shipping_order_actual_weight_check check
 (actual_weight_kg is null or actual_weight_kg between 0.001 and 99999.999);

create function private.guard_pdc_measured_weight() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.actual_weight_kg is distinct from old.actual_weight_kg and
  (old.dispatch_started_at is not null or old.awb is not null or old.attempt_count>0) then
  raise exception 'The dispatched parcel weight cannot change.';
 end if;
 return new;
end $$;
revoke all on function private.guard_pdc_measured_weight() from public,anon,authenticated,service_role;
create trigger guard_pdc_measured_weight before update of actual_weight_kg
 on public.shipping_order_jobs for each row execute function private.guard_pdc_measured_weight();

do $$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('private.pdc_order_eligibility(uuid)'::regprocedure);
 anchor:=E'and o.payment_method=''cash'' and not o.is_preorder and o.erp_owner=''built_in''';
 if position(anchor in definition)=0 then raise exception 'Manual PDC eligibility changed.';end if;
 definition:=replace(definition,anchor,E'and o.payment_method in (''cash'',''card'') and not o.is_preorder and o.erp_owner=''built_in''');
 anchor:=E'if (not (o.payment_method=''cash'' and not o.is_preorder and o.erp_owner=''built_in''';
 if position(anchor in definition)=0 then raise exception 'Untracked PDC allocation guard changed.';end if;
 definition:=replace(definition,anchor,E'if (not (o.payment_method in (''cash'',''card'') and not o.is_preorder and o.erp_owner=''built_in''');
 execute definition;

 definition:=pg_get_functiondef('public.shipping_order_take(uuid,boolean,jsonb)'::regprocedure);
 anchor:='token:=gen_random_uuid();';
 if position(anchor in definition)=0 then raise exception 'PDC dispatch boundary changed.';end if;
 definition:=replace(definition,anchor,E'if j.awb is null and j.actual_weight_kg is null then\n  raise exception ''Measure and confirm the packed parcel weight first.'';end if;\n token:=gen_random_uuid();');
 anchor:='''task'',case when j.awb is null then ''book'' else ''label'' end';
 if position(anchor in definition)=0 then raise exception 'PDC claim projection changed.';end if;
 definition:=replace(definition,anchor,'''actual_weight_kg'',j.actual_weight_kg,'||anchor);
 execute definition;
end $$;

create function public.shipping_order_prepare_measured(p_admin uuid,p_order uuid,p_actual_weight_kg numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prepared jsonb;j public.shipping_order_jobs%rowtype;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Server access required.' using errcode='42501';end if;
 if p_actual_weight_kg is null or p_actual_weight_kg not between 0.001 and 99999.999
  or p_actual_weight_kg<>trunc(p_actual_weight_kg,3) then
  raise exception 'A measured parcel weight is required.';end if;
 -- Existing prepare owns authorization, order lock, eligibility and uncertainty.
 prepared:=public.shipping_order_prepare(p_admin,p_order);
 select * into j from public.shipping_order_jobs where id=(prepared->>'id')::uuid for update;
 if j.awb is not null then return prepared;end if;
 if j.dispatch_started_at is not null or j.attempt_count>0 or j.state in ('uncertain','submitting')
  or exists(select 1 from private.pdc_dispatches where order_id=p_order) then
  raise exception 'Review the original booking; never rebook.';end if;
 if j.actual_weight_kg is not null and j.actual_weight_kg<>p_actual_weight_kg then
  raise exception 'The saved parcel weight changed; review the original booking.';end if;
 update public.shipping_order_jobs set actual_weight_kg=p_actual_weight_kg where id=j.id and actual_weight_kg is null;
 return prepared||jsonb_build_object('actual_weight_kg',p_actual_weight_kg);
end $$;
revoke all on function public.shipping_order_prepare_measured(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.shipping_order_prepare_measured(uuid,uuid,numeric) to service_role;

notify pgrst,'reload schema';
commit;
