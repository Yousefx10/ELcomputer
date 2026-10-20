-- 87: selected-courier dispatch, durable no-repeat barrier, private VPS labels.
-- No provider enablement, booking, prices, coverage or business data are seeded.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table public.commerce_shipping_companies add column provider text not null default 'manual' check(provider in ('manual','pdc'));
alter table public.shipping_provider_settings add column cod_enabled boolean not null default false;
alter table public.shipping_order_jobs drop constraint shipping_order_jobs_state_check;
alter table public.shipping_order_jobs add constraint shipping_order_jobs_state_check check(state in ('queued','blocked','submitting','label_pending','ready','failed','uncertain'));
alter table public.shipping_order_jobs add column work_token uuid,add column lease_until timestamptz,
 add column dispatch_started_at timestamptz,add column requested_by uuid,add column label_sha256 text,
 add column label_size_bytes bigint,add column cod_amount_minor bigint,add column provider_identity jsonb not null default '{}';
alter table public.shipping_claim_jobs add column label_sha256 text,add column label_size_bytes bigint;

-- Survives job/order reset. A missing local acknowledgement never authorizes a
-- second SaveShipmentEx. No credentials, address, provider body or financial post.
create table private.pdc_dispatches(job_id uuid primary key,order_id uuid not null unique,to_ref text not null unique,
 token uuid not null,actor_id uuid,state text not null check(state in ('dispatched','uncertain','created')),
 awb text,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
create unique index pdc_dispatches_awb_key on private.pdc_dispatches(awb) where awb is not null;
alter table private.pdc_dispatches enable row level security;
revoke all on private.pdc_dispatches from public,anon,authenticated,service_role;
grant select on private.pdc_dispatches to service_role;
-- Retain dispatch barriers across resets while keeping unknown-table rejection.
do $$ declare d text;anchor text:='''checkout_quotes'',''checkout_commands''';begin
 d:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 if position(anchor in d)=0 then raise exception 'Review courier reset retention.';end if;
 execute replace(d,anchor,anchor||',''pdc_dispatches''');
end $$;

-- Reuse the existing stock/price/delivery quote. PDC destinations additionally
-- require the owner's selected account product and exact synchronized mapping.
create function private.pdc_checkout_delivery(p_company uuid,p_governorate text,p_city text,p_method text) returns integer
language plpgsql security definer set search_path='' as $$
declare c public.commerce_shipping_companies%rowtype;s public.shipping_provider_settings%rowtype;n integer;destination integer;
begin
 select * into c from public.commerce_shipping_companies where id=p_company for share;
 if c.provider is distinct from 'pdc' then return null;end if;
 select * into s from public.shipping_provider_settings where id='pdc' for share;
 if not found or not s.is_enabled or s.shipment_type_id<>1 or s.access_token_encrypted is null or s.webhook_secret_encrypted is null
  or s.origin_city_id is null or nullif(btrim(s.origin_address),'') is null or nullif(btrim(s.origin_contact_name),'') is null
  or coalesce(s.origin_phone,'') !~ '^01[0-9]{9}$' or (p_method='cash' and not s.cod_enabled) then raise exception 'Selected courier is unavailable.';end if;
 select count(*),min(provider_city_id) into n,destination from public.shipping_city_mappings where provider='pdc'
  and lower(btrim(governorate))=lower(btrim(p_governorate))
  and (lower(btrim(city))=lower(btrim(p_city)) or lower(btrim(city_arabic))=lower(btrim(p_city)));
 if n<>1 or not exists(select 1 from jsonb_array_elements(s.cities_cache) v where (v->>'id')::integer=destination)
  or not exists(select 1 from jsonb_array_elements(s.cities_cache) v where (v->>'id')::integer=s.origin_city_id)
  or not exists(select 1 from jsonb_array_elements(s.products_cache) v where (v->>'id')::integer=s.product_id) then raise exception 'Selected courier destination is unavailable.';end if;
 return destination;
end $$;
do $$ declare d text;anchor text;begin
 d:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 anchor:='CREATE OR REPLACE FUNCTION private.checkout_review(';
 if position(anchor in d)=0 then raise exception 'Review courier checkout binding.';end if;
 execute replace(d,anchor,'CREATE OR REPLACE FUNCTION private.checkout_review_before_pdc(');
 d:=pg_get_functiondef('public.commerce_claim_payment_attempt(uuid,uuid,text,bigint)'::regprocedure);
 anchor:='if not o.card_checkout_verified or o.shipping_company_id is null then raise exception ''Review a new checkout before live payment.'';end if;';
 if position(anchor in d)=0 then raise exception 'Review live delivery binding.';end if;
 execute replace(d,anchor,anchor||E'\n perform private.cod_shipping(o.shipping_company_id,o.governorate);\n perform private.pdc_checkout_delivery(o.shipping_company_id,o.governorate,o.city,o.payment_method);');
end $$;
create or replace function private.checkout_review(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare review jsonb;
begin
 review:=private.checkout_review_before_pdc(p_intent);
 if p_intent#>>'{order,payment_method}' in ('cash','card') then
  perform private.pdc_checkout_delivery((p_intent#>>'{order,shipping_company_id}')::uuid,p_intent#>>'{order,governorate}',p_intent#>>'{order,city}',p_intent#>>'{order,payment_method}');
 end if;
 return review;
end $$;
revoke all on function private.pdc_checkout_delivery(uuid,text,text,text),private.checkout_review_before_pdc(jsonb),private.checkout_review(jsonb) from public,anon,authenticated,service_role;

create function private.pdc_order_eligibility(p_order uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.customer_orders%rowtype; s public.shipping_provider_settings%rowtype; c public.commerce_shipping_companies%rowtype;
 destination integer; matches integer; collectible bigint;
begin
 select * into o from public.customer_orders where id=p_order for update;
 if not found or o.status<>'ready_to_deliver' or o.shipping_review_status not in ('not_required','approved')
  or (o.is_preorder and o.preorder_fulfillment_state<>'ready') then raise exception 'Order is not ready for courier booking.';end if;
 select * into c from public.commerce_shipping_companies where id=o.shipping_company_id for share;
 if not found or c.provider<>'pdc' or not c.is_active or not c.checkout_enabled or not exists(
  select 1 from unnest(c.checkout_governorates) a where lower(btrim(a))=lower(btrim(o.governorate))) then raise exception 'Selected courier does not cover this order.';end if;
 select * into s from public.shipping_provider_settings where id='pdc' for share;
 if not found or not s.is_enabled or s.shipment_type_id<>1 or s.product_id is null or s.access_token_encrypted is null
  or s.webhook_secret_encrypted is null or s.origin_city_id is null or nullif(btrim(s.origin_address),'') is null
  or nullif(btrim(s.origin_contact_name),'') is null or coalesce(s.origin_phone,'') !~ '^01[0-9]{9}$'
  or nullif(btrim(o.first_name),'') is null or nullif(btrim(o.street_address),'') is null or coalesce(o.phone,'') !~ '^01[0-9]{9}$' then raise exception 'Courier configuration is incomplete.';end if;
 if o.payment_method='cash' and not o.is_preorder then
  if not s.cod_enabled or o.payment_status not in ('pending','partially_paid','paid') or o.amount_paid<0 or o.amount_paid>o.total_amount
   or o.amount_paid<>(select coalesce(sum(amount),0) from public.order_cod_collections where order_id=o.id) then raise exception 'COD courier collection is unavailable.';end if;
  collectible:=((o.total_amount-o.amount_paid)*100)::bigint;
 elsif o.payment_method='card' then
  if o.payment_status<>'paid' or o.amount_paid<>o.total_amount or not exists(select 1 from public.payment_attempts
   where order_id=o.id and mode='live' and status='succeeded' and amount_minor=o.total_amount*100) then raise exception 'Verified live payment is required.';end if;
  collectible:=0;
 else
  if o.payment_status<>'paid' or o.amount_paid<>o.total_amount then raise exception 'Verified payment is required.';end if;
  collectible:=0;
 end if;
 if not exists(select 1 from public.order_packing_sessions p join public.order_packing_videos v on v.packing_session_id=p.id
  where p.order_id=o.id and p.status='completed' and p.completed_at is not null and v.order_id=o.id and v.status='ready'
   and v.storage_backend='vps' and v.validated_at is not null and v.sha256 is not null) then raise exception 'Completed packing evidence is required.';end if;
 if exists(select 1 from public.customer_order_items i join public.products p on p.id=i.product_id where i.order_id=o.id and p.is_serialized
  and (select count(*) from public.commerce_serialized_units u where u.customer_order_item_id=i.id and u.customer_order_id=o.id and u.status='sold')<>i.quantity)
  or not exists(select 1 from public.customer_order_items where order_id=o.id) then raise exception 'Allocated order stock is unavailable.';end if;
 select count(*),min(provider_city_id) into matches,destination from public.shipping_city_mappings
  where provider='pdc' and lower(btrim(governorate))=lower(btrim(o.governorate))
   and (lower(btrim(city))=lower(btrim(o.city)) or lower(btrim(city_arabic))=lower(btrim(o.city)));
 if matches<>1 or not exists(select 1 from jsonb_array_elements(s.cities_cache) v where (v->>'id')::integer=destination)
  or not exists(select 1 from jsonb_array_elements(s.cities_cache) v where (v->>'id')::integer=s.origin_city_id)
  or not exists(select 1 from jsonb_array_elements(s.products_cache) v where (v->>'id')::integer=s.product_id) then raise exception 'Sync and choose an unambiguous courier destination/product.';end if;
 return jsonb_build_object('order',to_jsonb(o),'city_id',destination,'cod_amount_minor',collectible);
end $$;

create function public.shipping_order_prepare(p_admin uuid,p_order uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype;j public.shipping_order_jobs%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;
 select * into a from public.admin_users where id=p_admin for share;
 if not found or not a.is_active or (a.role<>'owner' and not coalesce((a.permissions->>'dashboard.orders')::boolean,false)) then raise exception 'Order permission required.' using errcode='42501';end if;
 perform 1 from public.customer_orders where id=p_order for update;
 select * into j from public.shipping_order_jobs where order_id=p_order for update;
 if found then return jsonb_build_object('id',j.id,'state',j.state,'awb',j.awb);end if;
 if exists(select 1 from private.pdc_dispatches where order_id=p_order) then raise exception 'Recover the original courier booking; never rebook.';end if;
 perform private.pdc_order_eligibility(p_order);
 insert into public.shipping_order_jobs(order_id,to_ref,requested_by) values(p_order,'ORD-'||p_order::text,p_admin) returning * into j;
 return jsonb_build_object('id',j.id,'state',j.state,'awb',j.awb);
end $$;

create function public.shipping_order_take(p_job uuid,p_ready boolean,p_configuration jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.shipping_order_jobs%rowtype;s public.shipping_provider_settings%rowtype;e jsonb;token uuid;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;
 perform 1 from public.customer_orders where id=(select order_id from public.shipping_order_jobs where id=p_job) for update;
 select * into j from public.shipping_order_jobs where id=p_job for update;
 if not found or j.state='ready' or j.state='uncertain' or (j.state='submitting' and j.lease_until>clock_timestamp()) then return null;end if;
 if j.awb is null and (j.dispatch_started_at is not null or exists(select 1 from private.pdc_dispatches where order_id=j.order_id)
  or j.attempt_count>0 or j.request_payload<>'{}'::jsonb) then
  update public.shipping_order_jobs set state='uncertain',last_error='Booking requires REF reconciliation.',next_attempt_at=null where id=j.id;return null;
 end if;
 select * into s from public.shipping_provider_settings where id='pdc' for share;
 if p_ready is distinct from true or p_configuration is null or (to_jsonb(s) @> p_configuration) is distinct from true
  or not s.is_enabled or (j.requested_by is null and not s.auto_create_labels) then raise exception 'Courier configuration changed.';end if;
 if j.requested_by is not null and not exists(select 1 from public.admin_users where id=j.requested_by and is_active
  and (role='owner' or coalesce((permissions->>'dashboard.orders')::boolean,false))) then raise exception 'Order permission changed.' using errcode='42501';end if;
 if j.awb is null then e:=private.pdc_order_eligibility(j.order_id);
 else
  if j.provider_identity<>jsonb_build_object('base_url',s.base_url,'api_mode',s.api_mode,'company_id',s.company_id) then raise exception 'Label account changed.';end if;
  e:='{}'::jsonb;
 end if;
 token:=gen_random_uuid();
 if j.awb is null then
  insert into private.pdc_dispatches(job_id,order_id,to_ref,token,actor_id,state) values(j.id,j.order_id,j.to_ref,token,j.requested_by,'dispatched');
 end if;
 update public.shipping_order_jobs set state='submitting',work_token=token,lease_until=clock_timestamp()+interval '2 minutes',
  dispatch_started_at=case when j.awb is null then clock_timestamp() else dispatch_started_at end,
  cod_amount_minor=case when j.awb is null then (e->>'cod_amount_minor')::bigint else cod_amount_minor end,
  provider_identity=case when j.awb is null then jsonb_build_object('base_url',s.base_url,'api_mode',s.api_mode,'company_id',s.company_id) else provider_identity end,
  attempt_count=attempt_count+1,updated_at=clock_timestamp() where id=j.id;
 return e||jsonb_build_object('id',j.id,'token',token,'awb',j.awb,'to_ref',j.to_ref,'task',case when j.awb is null then 'book' else 'label' end);
end $$;

create function public.shipping_order_finish(p_job uuid,p_token uuid,p_state text,p_awb text default null,p_sha256 text default null,p_size bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.shipping_order_jobs%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;
 perform 1 from public.customer_orders where id=(select order_id from public.shipping_order_jobs where id=p_job) for update;
 select * into j from public.shipping_order_jobs where id=p_job for update;
 if not found or p_token is null or j.work_token is distinct from p_token then raise exception 'Courier lease changed.';end if;
 if p_state='created' then
  if p_awb is null or p_awb !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$' or j.awb is not null then raise exception 'Invalid courier identity.';end if;
  update public.shipping_order_jobs set state='label_pending',awb=p_awb,lease_until=null,last_error=null,next_attempt_at=null,updated_at=clock_timestamp() where id=j.id;
  update private.pdc_dispatches set state='created',awb=p_awb,updated_at=clock_timestamp() where order_id=j.order_id;
 elsif p_state='uncertain' and j.awb is null then
  update public.shipping_order_jobs set state='uncertain',lease_until=null,last_error='Booking requires REF reconciliation.',next_attempt_at=null where id=j.id;
  update private.pdc_dispatches set state='uncertain',updated_at=clock_timestamp() where order_id=j.order_id;
 elsif p_state in ('label_ready','label_failed') and j.awb is not null then
  if p_state='label_ready' and (p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_size is null or p_size not between 5 and 5242880) then raise exception 'Invalid private label evidence.';end if;
  update public.shipping_order_jobs set state=case when p_state='label_ready' then 'ready' else 'label_pending' end,
   label_storage_path=case when p_state='label_ready' then 'vps-v1/orders/'||j.order_id::text||'/'||j.id::text||'.pdf' else label_storage_path end,
   label_sha256=case when p_state='label_ready' then p_sha256 else label_sha256 end,label_size_bytes=case when p_state='label_ready' then p_size else label_size_bytes end,
   lease_until=null,last_error=case when p_state='label_failed' then 'Private label is unavailable.' end,
   next_attempt_at=case when p_state='label_failed' then clock_timestamp()+interval '5 minutes' end,updated_at=clock_timestamp() where id=j.id;
 else raise exception 'Invalid courier completion.';end if;
 return jsonb_build_object('id',j.id,'state',p_state);
end $$;

create function public.shipping_order_recover(p_admin uuid,p_order uuid,p_ref text,p_awb text,p_configuration jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare j public.shipping_order_jobs%rowtype;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_admin and is_active
  and (role='owner' or coalesce((permissions->>'dashboard.orders')::boolean,false))) then raise exception 'Order permission required.' using errcode='42501';end if;
 perform 1 from public.customer_orders where id=p_order for update;
 select * into j from public.shipping_order_jobs where order_id=p_order for update;
 if not found or p_configuration is null or j.to_ref is distinct from p_ref or j.state not in ('uncertain','submitting') or j.awb is not null
  or (j.state='submitting' and j.lease_until>clock_timestamp()) or p_awb is null or p_awb !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$' then raise exception 'Courier recovery conflict.';end if;
 if not exists(select 1 from public.shipping_provider_settings s where id='pdc' and is_enabled and to_jsonb(s) @> p_configuration
  and j.provider_identity=jsonb_build_object('base_url',s.base_url,'api_mode',s.api_mode,'company_id',s.company_id) for share) then raise exception 'Courier recovery configuration changed.';end if;
 update public.shipping_order_jobs set state='label_pending',awb=p_awb,work_token=gen_random_uuid(),lease_until=null,last_error=null,next_attempt_at=null where id=j.id;
 update private.pdc_dispatches set state='created',awb=p_awb,updated_at=clock_timestamp() where order_id=p_order;
end $$;

-- Block cancellation/address/cash-snapshot changes while a request is unresolved.
create function private.guard_pending_pdc_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.shipping_order_jobs where order_id=old.id and dispatch_started_at is not null and awb is null)
  and (new.status is distinct from old.status or new.amount_paid is distinct from old.amount_paid or new.shipping_company_id is distinct from old.shipping_company_id
   or new.street_address is distinct from old.street_address or new.city is distinct from old.city or new.governorate is distinct from old.governorate or new.phone is distinct from old.phone) then
  raise exception 'Reconcile the pending courier booking before changing delivery.';end if;
 return new;
end $$;
create trigger a_guard_pending_pdc_order before update on public.customer_orders for each row execute function private.guard_pending_pdc_order();

-- Keep the established scheduler entry points, but queue only packed selected-PDC
-- orders. Never reset a submitted/uncertain job to queued on a payment update.
create or replace function public.queue_paid_order_for_shipping() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.shipping_provider_settings where id='pdc' and is_enabled and auto_create_labels) then return new;end if;
 begin perform private.pdc_order_eligibility(new.id);exception when sqlstate 'P0001' then return new;end;
 insert into public.shipping_order_jobs(order_id,to_ref) values(new.id,'ORD-'||new.id::text) on conflict(order_id) do nothing;
 return new;
end $$;
create or replace function public.queue_eligible_paid_orders_for_shipping() returns integer language plpgsql security definer set search_path='' as $$
declare o record;n integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.';end if;
 if not exists(select 1 from public.shipping_provider_settings where id='pdc' and is_enabled and auto_create_labels) then return 0;end if;
 for o in select id from public.customer_orders where status='ready_to_deliver' order by created_at limit 100 loop
  begin
   perform private.pdc_order_eligibility(o.id);
   insert into public.shipping_order_jobs(order_id,to_ref) values(o.id,'ORD-'||o.id::text) on conflict(order_id) do nothing;
   if found then n:=n+1;end if;
  exception when sqlstate 'P0001' then null;end;
 end loop;return n;
end $$;

-- Extend existing reverse-label completion, retaining its token/actor/audit locks.
do $$ declare d text;anchor text;begin
 d:=pg_get_functiondef('public.shipping_claim_guard()'::regprocedure);
 anchor:='''label_storage_path'',''label_requested_by''';
 if position(anchor in d)=0 then raise exception 'Review private reverse label guard.';end if;
 execute replace(d,anchor,'''label_storage_path'',''label_sha256'',''label_size_bytes'',''label_requested_by''');
end $$;
create function public.shipping_claim_vps_label_finish(p_job uuid,p_token uuid,p_success boolean,p_sha256 text,p_size bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;
 if p_success and (p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_size is null or p_size not between 5 and 5242880) then raise exception 'Invalid private label evidence.';end if;
 perform public.shipping_claim_label_finish(p_job,p_token,p_success);
 perform set_config('app.reverse_write','on',true);
 update public.shipping_claim_jobs set label_sha256=case when p_success then p_sha256 end,label_size_bytes=case when p_success then p_size end,
  label_storage_path=case when p_success then 'vps-v1/claims/'||claim_id::text||'/'||id::text||'.pdf' end where id=p_job;
end $$;
create or replace function public.shipping_claim_read_label(p_admin uuid,p_claim uuid,p_job uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare j public.shipping_claim_jobs%rowtype;
begin
 perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
 select * into j from public.shipping_claim_jobs where id=p_job and claim_id=p_claim and label_state='ready';
 if not found or j.label_sha256 is null then raise exception 'Private VPS shipment label unavailable.' using errcode='P0002';end if;
 return jsonb_build_object('path',j.label_storage_path,'awb',j.awb,'sha256',j.label_sha256,'size_bytes',j.label_size_bytes);
end $$;
revoke insert,update,delete on public.shipping_order_jobs from service_role;
revoke all on function public.shipping_claim_label_finish(uuid,uuid,boolean) from service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.pronamespace::regnamespace::text ns from pg_proc p where p.proname in
 ('pdc_order_eligibility','guard_pending_pdc_order','shipping_order_prepare','shipping_order_take','shipping_order_finish','shipping_order_recover','shipping_claim_vps_label_finish') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.ns='public' then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
