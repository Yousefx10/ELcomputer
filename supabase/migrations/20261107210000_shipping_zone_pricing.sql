-- Owner request 7 Nov 2026 (phase 1: shipping and tracking).
-- Order emails and staff PDC booking for Daftra-mode orders shipped separately in
-- 20261107200000_daftra_mode_order_parity.sql.
-- 1. A delivery company can price checkout by governorate: zone rate, VAT, rounding
--    and a store-paid support amount, all managed in the Dashboard.
-- 2. Staff can attach a PDC airway bill booked outside the website so it is tracked.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.commerce_shipping_companies add column checkout_pricing jsonb;
comment on column public.commerce_shipping_companies.checkout_pricing is
 'Optional governorate pricing: zone rates before VAT, VAT percent, round-up step and store support. Null keeps client_shipping_price.';

create function private.checkout_pricing_valid(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select p is null or (
  jsonb_typeof(p)='object' and p->>'version'='1'
  and coalesce(p->>'vat_percent','') ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$'
  and coalesce(p->>'round_to','') ~ '^[1-9][0-9]{0,2}$' and (p->>'round_to')::integer<=100
  and coalesce(p->>'support','') ~ '^[0-9]{1,5}(\.[0-9]{1,2})?$'
  and jsonb_typeof(p->'zones')='object' and jsonb_typeof(p->'governorates')='object'
  and (select count(*) from jsonb_object_keys(p->'zones'))between 1 and 9
  and (select count(*) from jsonb_object_keys(p->'governorates'))between 1 and 40
  and not exists(select 1 from jsonb_each_text(p->'zones') z where z.key !~ '^[1-9]$' or z.value !~ '^[0-9]{1,5}(\.[0-9]{1,2})?$')
  and not exists(select 1 from jsonb_each_text(p->'governorates') g where length(btrim(g.key)) not between 1 and 80 or not (p->'zones') ? g.value)
  and (select count(*) from jsonb_object_keys(p) k where k not in ('version','vat_percent','round_to','support','zones','governorates'))=0)
$$;
create function private.guard_checkout_pricing() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.checkout_pricing_valid(new.checkout_pricing) then raise exception 'Shipping prices by governorate are invalid.' using errcode='22023'; end if;
 return new;
end $$;
create trigger guard_checkout_pricing before insert or update of checkout_pricing on public.commerce_shipping_companies
 for each row execute function private.guard_checkout_pricing();

-- Customer fee: the zone rate plus VAT, rounded up to the step, minus store support.
create function private.checkout_zone_fee(p jsonb,p_governorate text) returns numeric language plpgsql immutable set search_path='' as $$
declare zone text; gross numeric; step numeric;
begin
 if p is null then return null; end if;
 select g.value into zone from jsonb_each_text(p->'governorates') g where lower(btrim(g.key))=lower(btrim(p_governorate)) order by g.key limit 1;
 if zone is null then return null; end if;
 gross:=(p->'zones'->>zone)::numeric*(1+(p->>'vat_percent')::numeric/100); step:=(p->>'round_to')::numeric;
 return greatest(0,ceil(gross/step)*step-(p->>'support')::numeric)::numeric(12,2);
end $$;

create or replace function private.cod_shipping(p_company uuid,p_governorate text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare company public.commerce_shipping_companies%rowtype; fee numeric;
begin
 select * into company from public.commerce_shipping_companies
 where id=p_company and is_active and checkout_enabled for share;
 if not found or not exists(select 1 from unnest(company.checkout_governorates) area
  where lower(btrim(area))=lower(btrim(p_governorate)) and btrim(area)<>'') then
  raise exception 'checkout:delivery';
 end if;
 fee:=case when company.checkout_pricing is null then company.client_shipping_price else private.checkout_zone_fee(company.checkout_pricing,p_governorate) end;
 if fee is null then raise exception 'checkout:delivery'; end if;
 return jsonb_build_object('companyId',company.id,'companyName',company.name,'fee',fee);
end $$;

-- Checkout display reads the same fee function the order uses.
create function public.checkout_shipping_prices() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(c.id::text,(select coalesce(jsonb_object_agg(lower(btrim(a)),private.checkout_zone_fee(c.checkout_pricing,a)),'{}'::jsonb)
  from unnest(c.checkout_governorates) a where private.checkout_zone_fee(c.checkout_pricing,a) is not null)),'{}'::jsonb)
 from public.commerce_shipping_companies c where c.is_active and c.checkout_enabled and c.checkout_pricing is not null
$$;

-- An airway bill booked in the PDC portal. Its reference is the AWB itself, so tracking
-- matches PDC rows by AWB only; packing, payment and booking rules are unchanged.
create function public.shipping_order_attach_existing_awb(p_order_id uuid,p_admin_id uuid,p_awb text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare job public.shipping_order_jobs%rowtype; s public.shipping_provider_settings%rowtype; reference text;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_admin_id
  and is_active and (role='owner' or coalesce((permissions->>'dashboard.orders')::boolean,false))) then
  raise exception 'Order permission is required.' using errcode='42501';end if;
 if p_awb is null or p_awb !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$' then raise exception 'A real airway bill is required.';end if;
 reference:='AWB:'||p_awb;
 if not exists(select 1 from public.customer_orders where id=p_order_id and status not in ('cancelled','refunded','returned') for update) then
  raise exception 'An open order is required.';end if;
 select * into s from public.shipping_provider_settings where id='pdc' for share;
 if not found or not s.is_enabled or s.api_mode<>'production' then raise exception 'PDC is not configured.';end if;
 select * into job from public.shipping_order_jobs where order_id=p_order_id for update;
 if found and job.awb=p_awb and job.to_ref=reference then return jsonb_build_object('id',job.id,'awb',job.awb,'state',job.state);end if;
 if found and (job.awb is not null or job.dispatch_started_at is not null or job.state not in ('queued','blocked','failed'))
  or exists(select 1 from private.pdc_dispatches where order_id=p_order_id)
  or exists(select 1 from public.shipping_order_jobs where awb=p_awb or to_ref=reference) then
  raise exception 'Reconcile the original booking. Do not attach another airway bill.';end if;
 if found then update public.shipping_order_jobs set to_ref=reference where id=job.id;
 else insert into public.shipping_order_jobs(order_id,to_ref) values(p_order_id,reference);end if;
 update public.shipping_order_jobs set awb=p_awb,state='label_pending',requested_by=p_admin_id,dispatch_started_at=clock_timestamp(),
  awb_verified_at=clock_timestamp(),provider_identity=jsonb_build_object('base_url',s.base_url,'api_mode',s.api_mode,'company_id',s.company_id),
  last_error=null,next_attempt_at=null,updated_at=clock_timestamp() where order_id=p_order_id returning * into job;
 insert into private.pdc_dispatches(job_id,order_id,to_ref,token,actor_id,state,awb)
  values(job.id,p_order_id,reference,gen_random_uuid(),p_admin_id,'created',p_awb);
 return jsonb_build_object('id',job.id,'awb',job.awb,'state',job.state);
end $$;

revoke all on function private.checkout_pricing_valid(jsonb),private.checkout_zone_fee(jsonb,text),private.guard_checkout_pricing(),public.checkout_shipping_prices(),
 public.shipping_order_attach_existing_awb(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.checkout_shipping_prices(),public.shipping_order_attach_existing_awb(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
