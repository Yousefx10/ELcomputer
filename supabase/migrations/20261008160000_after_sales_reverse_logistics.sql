-- Stage 2 only. No bookings/backfill/activation/notifications/financial effects.
begin;
alter table public.shipping_provider_settings
  add column reverse_enabled boolean not null default false,
  add column reverse_shipment_type_id integer check(reverse_shipment_type_id=3);
alter function public.default_admin_permissions() rename to default_admin_permissions_before_reverse;
create function public.default_admin_permissions() returns jsonb language sql immutable set search_path='' as $$
  select public.default_admin_permissions_before_reverse() || jsonb_build_object('claims.logistics.view',false,'claims.logistics.create',false,'claims.logistics.retry',false,'claims.logistics.diagnostics',false);
$$;
alter table public.admin_users alter column permissions set default public.default_admin_permissions();

create table public.shipping_claim_jobs (
  id uuid primary key, claim_id uuid not null references public.after_sales_claims(id) on delete restrict,
  initiated_by uuid not null references public.admin_users(id) on delete restrict,
  submission_key uuid not null unique, submission jsonb not null,
  previous_job_id uuid references public.shipping_claim_jobs(id) on delete restrict,
  to_ref text not null unique check(to_ref ~ '^ASREV-[a-f0-9]{32}$'),
  quantity integer not null check(quantity between 1 and 99),
  pickup jsonb not null check(jsonb_typeof(pickup)='object'), destination jsonb not null check(jsonb_typeof(destination)='object'),
  handling_resolution text not null check(handling_resolution in ('repair','replacement','refund')),
  confirmation_reason text not null check(char_length(btrim(confirmation_reason)) between 1 and 1000),
  settings_fingerprint text not null, provider_identity jsonb not null, shipment_payload jsonb not null,
  state text not null default 'queued' check(state in ('queued','creating','created','failed','uncertain','cancelled','returned','delivered')),
  awb text unique check(awb ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$'),
  diagnostic text, work_token uuid, started_at timestamptz,
  expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
  normalized_state text not null default 'unknown' check(public.shipping_valid_state(normalized_state)),
  provider_status_id integer, provider_status_at timestamptz, provider_observed_at timestamptz,
  reconciliation_attempted_at timestamptz,
  label_state text not null default 'not_requested' check(label_state in ('not_requested','queued','creating','ready','failed')),
  label_token uuid, label_started_at timestamptz, label_storage_path text, label_requested_by uuid references public.admin_users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  check(state not in ('created','cancelled','returned','delivered') or awb is not null)
);
create unique index shipping_claim_one_active on public.shipping_claim_jobs(claim_id) where state in ('queued','creating','created','uncertain');
create index shipping_claim_queue on public.shipping_claim_jobs(state,created_at);
create index shipping_claim_history on public.shipping_claim_jobs(claim_id,created_at desc,id);
alter table public.shipping_webhook_events add column claim_shipment_job_id uuid references public.shipping_claim_jobs(id) on delete restrict;
create index shipping_claim_event_history on public.shipping_webhook_events(claim_shipment_job_id,status_date,received_at);
alter table public.shipping_webhook_events add constraint shipping_event_one_purpose check(shipment_job_id is null or claim_shipment_job_id is null);
alter table public.after_sales_claim_events drop constraint after_sales_claim_events_event_type_check;
alter table public.after_sales_claim_events add constraint after_sales_claim_events_event_type_check check(event_type in ('submitted','review','request_information','customer_response','approve','reject','receive','inspect','select_resolution','resolve','cancel','note','verify_serial','evidence_added','reverse_queued','reverse_created','reverse_failed','reverse_uncertain','reverse_tracking','reverse_received','reverse_label','reverse_label_failed'));
alter table public.after_sales_claim_events drop constraint after_sales_claim_events_actor_kind_check;
alter table public.after_sales_claim_events add constraint after_sales_claim_events_actor_kind_check check(actor_kind in ('customer','staff','provider','worker'));
alter table public.shipping_claim_jobs enable row level security;
revoke all on public.shipping_claim_jobs from public,anon,authenticated,service_role;
grant select on public.shipping_claim_jobs to service_role;
-- Keep claim labels private even alongside broad pre-existing Storage rules.
-- Existing outbound label paths are unaffected.
create policy reverse_label_server_boundary on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id<>'shipping-labels' or name not like 'claims/%')
  with check(bucket_id<>'shipping-labels' or name not like 'claims/%');

create function public.shipping_claim_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='TRUNCATE' or tg_op='DELETE' or current_setting('app.reverse_write',true) is distinct from 'on' then raise exception 'Canonical reverse operation required.' using errcode='42501'; end if;
  if tg_op='UPDATE' and (to_jsonb(new)-array['state','awb','diagnostic','work_token','started_at','normalized_state','provider_status_id','provider_status_at','provider_observed_at','reconciliation_attempted_at','label_state','label_token','label_started_at','label_storage_path','label_requested_by','updated_at']) is distinct from
    (to_jsonb(old)-array['state','awb','diagnostic','work_token','started_at','normalized_state','provider_status_id','provider_status_at','provider_observed_at','reconciliation_attempted_at','label_state','label_token','label_started_at','label_storage_path','label_requested_by','updated_at']) then raise exception 'Reverse snapshot is immutable.' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.awb is not null and new.awb is distinct from old.awb then raise exception 'Reverse AWB is immutable.' using errcode='42501'; end if;
  return new;
end $$;

create trigger shipping_claim_guard before insert or update or delete on public.shipping_claim_jobs for each row execute function public.shipping_claim_guard();
create trigger shipping_claim_truncate before truncate on public.shipping_claim_jobs for each statement execute function public.shipping_claim_guard();

-- A reserved namespace and a shared AWB lock prevent purpose/identity collisions.
create function public.shipping_pdc_identity_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='shipping_order_jobs' and new.to_ref ~ '^ASREV-' and (tg_op='INSERT' or new.to_ref is distinct from old.to_ref) then raise exception 'Reserved reverse reference.' using errcode='23514'; end if;
  if new.awb is not null and (tg_op='INSERT' or new.awb is distinct from old.awb) then
    perform pg_advisory_xact_lock(hashtextextended('pdc:awb:'||new.awb,0));
    if (tg_table_name='shipping_order_jobs' and exists(select 1 from public.shipping_claim_jobs where awb=new.awb)) or
       (tg_table_name='shipping_claim_jobs' and exists(select 1 from public.shipping_order_jobs where provider='pdc' and awb=new.awb)) then raise exception 'Courier identity conflict.' using errcode='23505'; end if;
  end if;
  return new;
end $$;
create trigger shipping_order_purpose_guard before insert or update of to_ref,awb on public.shipping_order_jobs for each row execute function public.shipping_pdc_identity_guard();
create trigger shipping_claim_identity_guard before insert or update of awb on public.shipping_claim_jobs for each row execute function public.shipping_pdc_identity_guard();

create function public.shipping_claim_emit(p_job uuid,p_event text,p_kind text default 'staff',p_body text default '',p_visible boolean default true,p_actor uuid default null) returns void
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype; a public.admin_users%rowtype; actor_id uuid;
begin
  select * into j from public.shipping_claim_jobs where id=p_job;
  actor_id:=coalesce(p_actor,j.initiated_by);
  perform set_config('app.after_sales_claim_write','on',true);
  perform public.after_sales_claim_emit(j.claim_id,actor_id,p_kind,p_event,p_body,p_visible);
  perform set_config('app.after_sales_claim_write','off',true);
  if p_kind<>'staff' then
    select * into a from public.admin_users where id=actor_id;
    insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'claims.'||p_event,'Updated claim reverse logistics.',jsonb_build_object('claim_id',j.claim_id,'job_id',j.id,'state',j.state,'awb',j.awb,'source',p_kind,'diagnostic',j.diagnostic));
  end if;
end $$;

create function public.shipping_claim_schedule(p_admin uuid,p_claim uuid,p_revision integer,p_key uuid,p_input jsonb,p_ready boolean) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare c public.after_sales_claims%rowtype; s public.shipping_provider_settings%rowtype; m public.shipping_city_mappings%rowtype; policy jsonb; old_job public.shipping_claim_jobs%rowtype;
  j public.shipping_claim_jobs%rowtype; pickup jsonb; dest jsonb; new_job_id uuid:=gen_random_uuid(); previous uuid; handling text; reason text;
begin
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.create');
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
  if p_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('pickup','handling_resolution','reason','return_required','previous_job_id')) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  select * into c from public.after_sales_claims where id=p_claim for update;
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  select * into j from public.shipping_claim_jobs where submission_key=p_key;
  if found then
    if j.claim_id<>p_claim or j.initiated_by<>p_admin or j.submission<>p_input then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
    return jsonb_build_object('id',j.id,'state',j.state,'to_ref',j.to_ref,'idempotent',true);
  end if;
  if p_revision is null or c.revision<>p_revision then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
  previous:=nullif(p_input->>'previous_job_id','')::uuid;
  select * into old_job from public.shipping_claim_jobs where claim_id=c.id order by created_at desc,id desc limit 1;
  if found then
    perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.retry');
    if previous is distinct from old_job.id or old_job.state not in ('failed','cancelled','returned') then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  elsif previous is not null then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  if c.status<>'approved' and not(previous is not null and c.status in ('pickup_scheduled','in_transit')) then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  if exists(select 1 from public.shipping_claim_jobs where claim_id=c.id and state in ('queued','creating','created','uncertain')) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  if exists(select 1 from public.customer_orders o join public.customer_profiles p on p.id=o.user_id where o.id=c.order_id and (o.user_id<>c.customer_id or not p.is_active or o.status in ('cancelled','refunded') or o.payment_status='refunded')) then raise exception 'Claim eligibility denied.' using errcode='23514'; end if;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=c.policy_version_id;
  handling:=p_input->>'handling_resolution'; reason:=btrim(coalesce(p_input->>'reason',''));
  if p_input->'return_required' is distinct from 'true'::jsonb or char_length(reason) not between 1 and 1000 or handling is null or handling='service_center' or c.resolution='service_center' or
    (c.claim_type='return' and (handling<>'refund' or not coalesce((policy->>'return_enabled')::boolean,false))) or
    (c.claim_type='warranty' and (not coalesce((policy->>'warranty_enabled')::boolean,false) or not coalesce(policy->'warranty_resolutions' ? handling,false))) then raise exception 'Reverse item return required.' using errcode='23514'; end if;
  pickup:=p_input->'pickup';
  if pickup is null or jsonb_typeof(pickup)<>'object' or exists(select 1 from jsonb_object_keys(pickup) k where k not in ('name','phone','address','city_mapping_id')) or
    jsonb_typeof(pickup->'name')<>'string' or char_length(btrim(coalesce(pickup->>'name',''))) not between 1 and 100 or
    jsonb_typeof(pickup->'address')<>'string' or char_length(btrim(coalesce(pickup->>'address',''))) not between 1 and 1000 or
    coalesce(pickup->>'phone','') !~ '^01[0-9]{9}$' or pickup->>'city_mapping_id' is null then raise exception 'Invalid pickup details.' using errcode='22023'; end if;
  select * into m from public.shipping_city_mappings where id=(pickup->>'city_mapping_id')::uuid and provider='pdc';
  if not found then raise exception 'Reverse city mapping required.' using errcode='23514'; end if;
  select * into s from public.shipping_provider_settings where id='pdc' for share;
  if p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled or s.reverse_shipment_type_id is distinct from 3 or s.access_token_encrypted is null or s.webhook_secret_encrypted is null or
    s.origin_city_id is null or nullif(btrim(s.origin_address),'') is null or coalesce(s.origin_phone,'') !~ '^01[0-9]{9}$' or nullif(btrim(s.origin_contact_name),'') is null then raise exception 'Reverse provider not ready.' using errcode='23514'; end if;
  if exists(select 1 from public.shipping_order_jobs where to_ref='ASREV-'||replace(new_job_id::text,'-','')) then raise exception 'Courier identity conflict.' using errcode='23505'; end if;
  pickup:=jsonb_build_object('name',btrim(pickup->>'name'),'phone',pickup->>'phone','address',btrim(pickup->>'address'),'city_mapping_id',m.id,'city',m.city,'governorate',m.governorate,'provider_city_id',m.provider_city_id);
  dest:=jsonb_build_object('name',s.origin_contact_name,'phone',s.origin_phone,'address',s.origin_address,'provider_city_id',s.origin_city_id);
  perform set_config('app.reverse_write','on',true);
  insert into public.shipping_claim_jobs(id,claim_id,initiated_by,submission_key,submission,previous_job_id,to_ref,quantity,pickup,destination,handling_resolution,confirmation_reason,settings_fingerprint,provider_identity,shipment_payload)
  values(new_job_id,c.id,p_admin,p_key,p_input,previous,'ASREV-'||replace(new_job_id::text,'-',''),c.quantity,pickup,dest,handling,reason,md5(to_jsonb(s)::text),jsonb_build_object('company_id',s.company_id,'base_url',s.base_url,'api_mode',s.api_mode),
    jsonb_build_object('allMustValid',true,'hasAWBs',false,'extraParams','{}'::jsonb,'shipments',jsonb_build_array(jsonb_build_object(
      'fromCityID',m.provider_city_id,'fromAddress',pickup->>'address','fromPhone',pickup->>'phone','fromContactPerson',pickup->>'name',
      'toCityID',s.origin_city_id,'toAddress',s.origin_address,'toPhone',s.origin_phone,'toConsigneeName',s.origin_contact_name,
      'toRef','ASREV-'||replace(new_job_id::text,'-',''),'productID',s.product_id,'shipmentTypeID',s.reverse_shipment_type_id,'weight',s.default_weight_kg,'pieces',c.quantity,'cod',0,'refuseCOD',0))));
  perform set_config('app.after_sales_claim_write','on',true);
  update public.after_sales_claims set revision=revision+1,updated_at=clock_timestamp() where id=c.id;
  perform public.shipping_claim_emit(new_job_id,'reverse_queued','staff','',true);
  perform set_config('app.reverse_write','off',true);
  return jsonb_build_object('id',new_job_id,'state','queued','to_ref','ASREV-'||replace(new_job_id::text,'-',''));
end $$;

create function public.shipping_claim_take(p_ready boolean,p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype; s public.shipping_provider_settings%rowtype; result jsonb:='[]'; token uuid; code text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  select * into s from public.shipping_provider_settings where id='pdc';
  for j in select * from public.shipping_claim_jobs where state='queued' or (state='creating' and started_at<clock_timestamp()-interval '2 minutes') order by created_at limit least(greatest(coalesce(p_limit,10),1),25) loop
    -- Same item -> claim -> job lock order as customer/staff Claims actions.
    perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=j.claim_id) for update;
    select * into c from public.after_sales_claims where id=j.claim_id for update;
    select * into j from public.shipping_claim_jobs where id=j.id for update;
    if j.state not in ('queued','creating') then continue; end if;
    perform set_config('app.reverse_write','on',true);
    if j.state='creating' then
      if j.started_at>=clock_timestamp()-interval '2 minutes' then continue; end if;
      update public.shipping_claim_jobs set state='uncertain',diagnostic='interrupted',updated_at=clock_timestamp() where id=j.id;
      perform public.shipping_claim_emit(j.id,'reverse_uncertain','worker','',true); continue;
    end if;
    code:=case when p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled then 'provider_not_ready'
      when j.settings_fingerprint<>md5(to_jsonb(s)::text) then 'configuration_changed' when j.expires_at<=clock_timestamp() then 'expired'
      when c.status not in ('approved','pickup_scheduled','in_transit') then 'claim_changed'
      when not exists(select 1 from public.admin_users a where a.id=j.initiated_by and a.is_active and (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.create')::boolean,false)))) then 'permission_changed' end;
    if code is not null then
      update public.shipping_claim_jobs set state='failed',diagnostic=code,updated_at=clock_timestamp() where id=j.id;
      perform public.shipping_claim_emit(j.id,'reverse_failed','worker','',true); continue;
    end if;
    token:=gen_random_uuid();
    update public.shipping_claim_jobs set state='creating',work_token=token,started_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'token',token,'to_ref',j.to_ref,'payload',j.shipment_payload));
  end loop;
  perform set_config('app.reverse_write','off',true);
  return result;
end $$;

create function public.shipping_claim_dispatch(p_job uuid,p_token uuid,p_ready boolean,p_configuration jsonb default null) returns boolean
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype; s public.shipping_provider_settings%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job)) for update;
  select * into c from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job) for update;
  select * into j from public.shipping_claim_jobs where id=p_job for update;
  select * into s from public.shipping_provider_settings where id='pdc' for share;
  if not found or j.state<>'creating' or p_token is null or p_token is distinct from j.work_token then return false; end if;
  if p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled or md5(to_jsonb(s)::text)<>j.settings_fingerprint or (p_configuration is not null and (to_jsonb(s) @> p_configuration) is distinct from true) or j.expires_at<=clock_timestamp() or c.status not in ('approved','pickup_scheduled','in_transit') or
    exists(select 1 from public.customer_orders o join public.customer_profiles p on p.id=o.user_id where o.id=c.order_id and (not p.is_active or o.status in ('cancelled','refunded') or o.payment_status='refunded')) or
    not exists(select 1 from public.admin_users a where a.id=j.initiated_by and a.is_active and (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.create')::boolean,false)))) then
    perform set_config('app.reverse_write','on',true);
    update public.shipping_claim_jobs set state='failed',diagnostic='configuration_changed',updated_at=clock_timestamp() where id=j.id;
    perform public.shipping_claim_emit(j.id,'reverse_failed','worker','',true);
    return false;
  end if;
  return true;
end $$;

create function public.shipping_claim_finish(p_job uuid,p_token uuid,p_state text,p_ref text default null,p_awb text default null,p_code text default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job)) for update;
  select * into c from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job) for update;
  select * into j from public.shipping_claim_jobs where id=p_job for update;
  if not found then raise exception 'Shipment not found.' using errcode='P0002'; end if;
  if j.state='created' and j.to_ref=p_ref and j.awb=p_awb then return jsonb_build_object('id',j.id,'idempotent',true); end if;
  if p_token is null or p_token is distinct from j.work_token or j.state not in ('creating','uncertain') or p_state not in ('created','failed','uncertain') then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  if p_state='created' and (p_ref is distinct from j.to_ref or p_awb is null or p_awb !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$') then raise exception 'Reverse response mismatch.' using errcode='23514'; end if;
  if p_state<>'created' and coalesce(p_code,'') not in ('timeout','invalid_response','ref_mismatch','provider_rejected','provider_unavailable','awb_conflict','interrupted') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform set_config('app.reverse_write','on',true);
  update public.shipping_claim_jobs set state=p_state,awb=case when p_state='created' then p_awb else awb end,diagnostic=case when p_state='created' then null else p_code end,updated_at=clock_timestamp() where id=j.id;
  if p_state='created' and c.status in ('approved','pickup_scheduled','in_transit') then
    perform set_config('app.after_sales_claim_write','on',true);
    update public.after_sales_claims set status='pickup_scheduled',revision=revision+1,updated_at=clock_timestamp() where id=c.id;
  end if;
  perform public.shipping_claim_emit(j.id,case p_state when 'created' then 'reverse_created' when 'failed' then 'reverse_failed' else 'reverse_uncertain' end,'worker','',true);
  perform set_config('app.reverse_write','off',true);
  return jsonb_build_object('id',j.id,'state',p_state);
end $$;

create function public.shipping_claim_view(p_actor uuid,p_claim uuid,p_staff boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare c public.after_sales_claims%rowtype; o public.customer_orders%rowtype; a public.admin_users%rowtype; policy jsonb; jobs jsonb; history jsonb; cities jsonb:='[]'; prefill jsonb; operational boolean:=false; has_diagnostics boolean:=false; can_book boolean:=false;
begin
  perform public.after_sales_claim_assert_actor(p_actor,case when p_staff then 'claims.view' end);
  select * into c from public.after_sales_claims where id=p_claim and (p_staff or customer_id=p_actor);
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_staff then
    select * into a from public.admin_users where id=p_actor;
    operational:=a.role='owner' or coalesce((a.permissions->>'claims.logistics.view')::boolean,false);
    has_diagnostics:=operational and (a.role='owner' or coalesce((a.permissions->>'claims.logistics.diagnostics')::boolean,false));
    can_book:=operational and (a.role='owner' or coalesce((a.permissions->>'claims.logistics.create')::boolean,false));
  end if;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=c.policy_version_id;
  select coalesce(jsonb_agg(value order by created_at desc,id desc),'[]') into jobs from (
    select j.id,j.created_at,jsonb_build_object('id',j.id,'to_ref',j.to_ref,'state',j.state,'awb',j.awb,'quantity',j.quantity,'normalized_state',j.normalized_state,
      'status_date',j.provider_status_at,'created_at',j.created_at,'pickup',case when not p_staff or operational then j.pickup-array['provider_city_id','city_mapping_id'] else null end,
      'label_ready',operational and j.label_state='ready','label_state',case when operational then j.label_state else null end,
      'diagnostic',case when has_diagnostics then j.diagnostic else null end,'previous_job_id',case when operational then j.previous_job_id else null end,
      'handling_resolution',case when operational then j.handling_resolution else null end,'confirmation_reason',case when operational then j.confirmation_reason else null end,
      'can_recover',operational and j.state='uncertain','can_refresh',operational and j.awb is not null,'can_label',can_book and j.awb is not null and j.state in ('created','delivered','cancelled','returned') and j.label_state not in ('queued','creating')) value
    from public.shipping_claim_jobs j where j.claim_id=c.id order by j.created_at desc,j.id desc limit 10
  ) x;
  select coalesce(jsonb_agg(value order by sort_at desc,id desc),'[]') into history from (
    select e.id,coalesce(e.status_date,e.received_at) sort_at,jsonb_build_object('id',e.id,'job_id',e.claim_shipment_job_id,'state',e.normalized_state,'status_date',e.status_date,'observed_at',e.received_at,'source',e.source,
      'provider_status_id',case when has_diagnostics then e.provider_status_id else null end,'provider_label',case when has_diagnostics then e.provider_status_name else null end,'provider_reason',case when has_diagnostics then e.reason_name else null end) value
    from public.shipping_webhook_events e join public.shipping_claim_jobs j on j.id=e.claim_shipment_job_id where j.claim_id=c.id order by coalesce(e.status_date,e.received_at) desc,e.id desc limit 200
  ) x;
  if can_book then
    select * into o from public.customer_orders where id=c.order_id;
    select jsonb_build_object('name',btrim(coalesce(o.first_name,'')||' '||coalesce(o.last_name,'')),'phone',o.phone,'address',o.street_address,
      'city_mapping_id',(select m.id from public.shipping_city_mappings m where m.provider='pdc' and lower(btrim(m.governorate))=lower(btrim(o.governorate)) and (lower(btrim(m.city))=lower(btrim(o.city)) or lower(btrim(m.city_arabic))=lower(btrim(o.city))) limit 1)) into prefill;
    select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'city',m.city,'city_arabic',m.city_arabic,'governorate',m.governorate) order by m.governorate,m.city),'[]') into cities from public.shipping_city_mappings m where m.provider='pdc';
  end if;
  return jsonb_build_object('jobs',jobs,'events',history,'cities',cities,'prefill',prefill,'operational',operational,'diagnostics',has_diagnostics,
    'active',exists(select 1 from public.shipping_claim_jobs where claim_id=c.id and state in ('queued','creating','created','uncertain')),
    'can_book',can_book and c.status in ('approved','pickup_scheduled','in_transit') and c.resolution is distinct from 'service_center' and
      not exists(select 1 from public.shipping_claim_jobs where claim_id=c.id and state in ('queued','creating','created','uncertain','delivered')),
    'can_retry',operational and (a.role='owner' or coalesce((a.permissions->>'claims.logistics.retry')::boolean,false)),
    'handling_resolutions',case when c.claim_type='return' then '["refund"]'::jsonb else coalesce((select jsonb_agg(x) from jsonb_array_elements_text(policy->'warranty_resolutions') x where x<>'service_center'),'[]') end);
end $$;

create function public.shipping_claim_operation(p_admin uuid,p_claim uuid,p_job uuid,p_action text,p_ready boolean) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
  perform public.after_sales_claim_assert_actor(p_admin,case when p_action='label' then 'claims.logistics.create' else 'claims.logistics.retry' end);
  if p_action is null or p_action not in ('refresh','recover','label') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  perform 1 from public.after_sales_claims where id=p_claim for update;
  select * into j from public.shipping_claim_jobs where id=p_job and claim_id=p_claim for update;
  if not found then raise exception 'Shipment not found.' using errcode='P0002'; end if;
  if p_ready is distinct from true or not exists(select 1 from public.shipping_provider_settings s where s.id='pdc' and s.is_enabled and s.reverse_enabled and jsonb_build_object('company_id',s.company_id,'base_url',s.base_url,'api_mode',s.api_mode)=j.provider_identity) then raise exception 'Reverse provider not ready.' using errcode='23514'; end if;
  if (p_action='recover' and j.state<>'uncertain') or (p_action in ('refresh','label') and j.awb is null) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  perform set_config('app.reverse_write','on',true);
  if p_action='label' then
    if j.label_state in ('queued','creating','ready') then return jsonb_build_object('queued',j.label_state<>'ready'); end if;
    update public.shipping_claim_jobs set label_state='queued',label_requested_by=p_admin,updated_at=clock_timestamp() where id=j.id;
    perform public.shipping_claim_emit(j.id,'reverse_label','staff','',false,p_admin);
    return jsonb_build_object('queued',true);
  end if;
  if j.reconciliation_attempted_at>clock_timestamp()-interval '5 minutes' then raise exception 'Reverse refresh throttled.' using errcode='23514'; end if;
  update public.shipping_claim_jobs set reconciliation_attempted_at=clock_timestamp() where id=j.id;
  perform public.shipping_claim_emit(j.id,'reverse_tracking','staff','',false,p_admin);
  return jsonb_build_object('id',j.id,'ref',j.to_ref,'awb',j.awb,'token',j.work_token,'observed_at',clock_timestamp());
end $$;

create function public.shipping_claim_label_take(p_ready boolean,p_limit integer default 10,p_configuration jsonb default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype; s public.shipping_provider_settings%rowtype; token uuid; result jsonb:='[]';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  select * into s from public.shipping_provider_settings where id='pdc';
  perform set_config('app.reverse_write','on',true);
  for j in select * from public.shipping_claim_jobs where label_state='queued' or (label_state='creating' and label_started_at<clock_timestamp()-interval '2 minutes') order by created_at limit least(greatest(coalesce(p_limit,10),1),25) loop
    perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=j.claim_id) for update;
    perform 1 from public.after_sales_claims where id=j.claim_id for update;
    select * into j from public.shipping_claim_jobs where id=j.id for update;
    if j.label_state not in ('queued','creating') or (j.label_state='creating' and j.label_started_at>=clock_timestamp()-interval '2 minutes') then continue; end if;
    if p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled or (p_configuration is not null and (to_jsonb(s) @> p_configuration) is distinct from true) or j.provider_identity<>jsonb_build_object('company_id',s.company_id,'base_url',s.base_url,'api_mode',s.api_mode) or j.label_state='creating' or
      not exists(select 1 from public.admin_users a where a.id=j.label_requested_by and a.is_active and (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.create')::boolean,false)))) then
      update public.shipping_claim_jobs set label_state='failed',updated_at=clock_timestamp() where id=j.id;
      perform public.shipping_claim_emit(j.id,'reverse_label_failed','worker','',false,j.label_requested_by); continue;
    end if;
    token:=gen_random_uuid(); update public.shipping_claim_jobs set label_state='creating',label_token=token,label_started_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'claim_id',j.claim_id,'awb',j.awb,'token',token));
  end loop;
  return result;
end $$;

create function public.shipping_claim_label_finish(p_job uuid,p_token uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job)) for update;
  perform 1 from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job) for update;
  select * into j from public.shipping_claim_jobs where id=p_job for update;
  if not found or p_token is null or p_token is distinct from j.label_token or j.label_state<>'creating' then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  perform set_config('app.reverse_write','on',true);
  update public.shipping_claim_jobs set label_state=case when p_success then 'ready' else 'failed' end,
    label_storage_path=case when p_success then 'claims/'||j.claim_id::text||'/'||j.id::text||'.pdf' end,updated_at=clock_timestamp() where id=j.id;
  perform public.shipping_claim_emit(j.id,case when p_success then 'reverse_label' else 'reverse_label_failed' end,'worker','',false,j.label_requested_by);
end $$;

create function public.shipping_claim_read_label(p_admin uuid,p_claim uuid,p_job uuid) returns jsonb
language plpgsql stable security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
  select * into j from public.shipping_claim_jobs where id=p_job and claim_id=p_claim and label_state='ready';
  if not found then raise exception 'Shipment not found.' using errcode='P0002'; end if;
  return jsonb_build_object('path',j.label_storage_path,'awb',j.awb);
end $$;

-- Both ingress sources share this canonical transaction; outbound SMS stays in
-- the original function and is never invoked for claim-linked events.
alter function public.shipping_record_pdc_event(jsonb) rename to shipping_record_pdc_event_outbound;
create function public.shipping_record_claim_pdc_event(p_update jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype; e public.shipping_webhook_events%rowtype;
  sid integer:=(p_update->>'status_id')::integer; at_time timestamptz:=(p_update->>'status_date')::timestamptz;
  observed timestamptz:=coalesce((p_update->>'observed_at')::timestamptz,clock_timestamp()); source_value text:=p_update->>'source';
  state_value text; stale boolean; enriched boolean:=false; next_status text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  if source_value is null or source_value not in ('webhook','reconciliation') or nullif(p_update->>'event_key','') is null or (source_value='webhook' and (sid is null or sid<=0 or at_time is null)) then raise exception 'Invalid courier event.'; end if;
  select * into j from public.shipping_claim_jobs where to_ref=p_update->>'ref';
  if not found then return jsonb_build_object('error','unknown_ref'); end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=j.claim_id) for update;
  select * into c from public.after_sales_claims where id=j.claim_id for update;
  select * into j from public.shipping_claim_jobs where id=j.id for update;
  if j.awb is null or j.awb is distinct from p_update->>'awb' then return jsonb_build_object('error','awb_mismatch'); end if;
  perform set_config('app.reverse_write','on',true);
  select * into e from public.shipping_webhook_events where claim_shipment_job_id=j.id and processed_at is not null and
    ((sid is not null and provider_status_id=sid) or event_key=p_update->>'event_key') order by received_at,id limit 1;
  if found then
    if source_value<>'webhook' or e.source<>'reconciliation' or e.status_date is not null then return jsonb_build_object('received',true,'duplicate',true); end if;
    update public.shipping_webhook_events set status_date=at_time,source='webhook',provider_status_name=nullif(p_update->>'status_name',''),reason_name=nullif(p_update->>'reason','') where id=e.id;
    enriched:=true; state_value:=e.normalized_state;
  else
    state_value:=public.shipping_resolve_pdc_state(sid,p_update->>'status_name');
    insert into public.shipping_webhook_events(provider,event_key,awb,order_ref,provider_status_id,provider_status_name,status_date,reason_name,payload,processed_at,claim_shipment_job_id,normalized_state,source)
      values('pdc',p_update->>'event_key',j.awb,j.to_ref,sid,nullif(p_update->>'status_name',''),at_time,nullif(p_update->>'reason',''),'{}',clock_timestamp(),j.id,state_value,source_value) returning * into e;
  end if;
  stale:=coalesce(at_time,observed)<=coalesce(j.provider_status_at,j.provider_observed_at,'-infinity'::timestamptz) or
    (source_value='reconciliation' and observed<=coalesce(j.provider_observed_at,'-infinity'::timestamptz)) or j.state in ('delivered','cancelled','returned');
  -- A dated callback may enrich the current undated observation once. A newer
  -- different observation prevents the old enrichment from taking precedence.
  if enriched and j.provider_status_at is null and j.provider_status_id is not distinct from sid and j.normalized_state=state_value and j.state='created' then stale:=false; end if;
  if not stale then
    perform set_config('app.reverse_write','on',true);
    update public.shipping_claim_jobs set normalized_state=state_value,provider_status_id=sid,provider_status_at=at_time,provider_observed_at=observed,
      state=case when at_time is not null and state_value in ('delivered','cancelled','returned') then state_value else state end,updated_at=clock_timestamp() where id=j.id;
    if at_time is not null and at_time>=j.created_at and not exists(select 1 from public.shipping_claim_jobs newer where newer.claim_id=c.id and (newer.created_at,newer.id)>(j.created_at,j.id)) then
      next_status:=case when state_value='delivered' and c.status in ('pickup_scheduled','in_transit') then 'received'
        when state_value in ('picked_up','in_transit','arrived_at_hub','out_for_delivery') and c.status='pickup_scheduled' then 'in_transit' end;
      if next_status is not null then
        perform set_config('app.after_sales_claim_write','on',true);
        update public.after_sales_claims set status=next_status,revision=revision+1,updated_at=clock_timestamp() where id=c.id;
      end if;
    end if;
    -- No raw labels/reasons/body are put in customer timeline or generic audit.
    if at_time is not null then perform public.shipping_claim_emit(j.id,case when next_status='received' then 'reverse_received' else 'reverse_tracking' end,'provider','',true); end if;
  end if;
  return jsonb_build_object('received',true,'duplicate',enriched,'enriched',enriched,'stale',stale);
end $$;
create function public.shipping_record_pdc_event(p_update jsonb) returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  if exists(select 1 from public.shipping_claim_jobs where to_ref=p_update->>'ref') then
    if exists(select 1 from public.shipping_order_jobs where provider='pdc' and to_ref=p_update->>'ref') then return jsonb_build_object('error','identity_conflict'); end if;
    return public.shipping_record_claim_pdc_event(p_update);
  end if;
  return public.shipping_record_pdc_event_outbound(p_update);
end $$;

create function public.shipping_claim_event_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='TRUNCATE' then
    if exists(select 1 from public.shipping_webhook_events where claim_shipment_job_id is not null) then raise exception 'Reverse history is retained.' using errcode='42501'; end if;
    return null;
  end if;
  if (tg_op<>'INSERT' and old.claim_shipment_job_id is not null) or (tg_op<>'DELETE' and new.claim_shipment_job_id is not null) then
    if tg_op='DELETE' or current_setting('app.reverse_write',true) is distinct from 'on' then raise exception 'Canonical reverse event required.' using errcode='42501'; end if;
    if tg_op='UPDATE' and (old.claim_shipment_job_id is null or old.status_date is not null or new.status_date is null or
      (to_jsonb(new)-array['status_date','source','provider_status_name','reason_name']) is distinct from (to_jsonb(old)-array['status_date','source','provider_status_name','reason_name'])) then raise exception 'Reverse history is immutable.' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger shipping_claim_event_guard before insert or update or delete on public.shipping_webhook_events for each row execute function public.shipping_claim_event_guard();
create trigger shipping_claim_event_truncate before truncate on public.shipping_webhook_events for each statement execute function public.shipping_claim_event_guard();

-- Retain existing staff/customer behavior; reserve courier/manual changes for
-- their guarded paths and prevent cancelling a live or uncertain booking.
alter function public.after_sales_claim_next(text) rename to after_sales_claim_next_before_reverse;
create function public.after_sales_claim_next(p_status text) returns text[] language sql immutable set search_path='' as $$
 select case p_status when 'pickup_scheduled' then array['in_transit','received'] when 'in_transit' then array['received'] when 'approved' then array['received','cancelled','pickup_scheduled'] else public.after_sales_claim_next_before_reverse(p_status) end;
$$;
alter function public.after_sales_claim_actions(text) rename to after_sales_claim_actions_before_reverse;
create function public.after_sales_claim_actions(p_status text) returns text[] language sql immutable set search_path='' as $$
 select case when p_status in ('pickup_scheduled','in_transit') then array['receive','note'] else public.after_sales_claim_actions_before_reverse(p_status) end;
$$;
alter function public.after_sales_claim_staff_action(uuid,uuid,integer,text,jsonb) rename to after_sales_claim_staff_action_before_reverse;
create function public.after_sales_claim_staff_action(p_admin uuid,p_claim uuid,p_revision integer,p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
begin
  perform public.after_sales_claim_assert_actor(p_admin,public.after_sales_claim_action_permission(p_action));
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  perform 1 from public.after_sales_claims where id=p_claim for update;
  if p_action in ('cancel','receive') and exists(select 1 from public.shipping_claim_jobs where claim_id=p_claim and state in ('queued','creating','created','uncertain')) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  return public.after_sales_claim_staff_action_before_reverse(p_admin,p_claim,p_revision,p_action,p_input);
end $$;
alter function public.after_sales_claim_customer_action(uuid,uuid,integer,text,jsonb) rename to after_sales_claim_customer_action_before_reverse;
create function public.after_sales_claim_customer_action(p_customer uuid,p_claim uuid,p_revision integer,p_action text,p_input jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  perform 1 from public.after_sales_claims where id=p_claim and customer_id=p_customer for update;
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_action='cancel' and exists(select 1 from public.shipping_claim_jobs where claim_id=p_claim and state in ('queued','creating','created','uncertain')) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  return public.after_sales_claim_customer_action_before_reverse(p_customer,p_claim,p_revision,p_action,p_input);
end $$;
alter function public.after_sales_claim_detail(uuid,uuid,boolean,uuid) rename to after_sales_claim_detail_before_reverse;
create function public.after_sales_claim_detail(p_actor uuid,p_claim uuid,p_staff boolean default false,p_before uuid default null) returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare result jsonb; active boolean;
begin
  result:=public.after_sales_claim_detail_before_reverse(p_actor,p_claim,p_staff,p_before);
  active:=exists(select 1 from public.shipping_claim_jobs where claim_id=p_claim and state in ('queued','creating','created','uncertain'));
  if active then result:=jsonb_set(result,'{allowed_actions}',coalesce((select jsonb_agg(x) from jsonb_array_elements_text(result->'allowed_actions') x where x not in ('receive','cancel')),'[]')); end if;
  return result||jsonb_build_object('customer_can_cancel',not active);
end $$;

do $reset$ declare definition text; anchor text:='''after_sales_claim_evidence'']'; begin
  definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Review reverse reset integration.'; end if;
  execute replace(definition,anchor,'''after_sales_claim_evidence'', ''shipping_claim_jobs'']');
end $reset$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'shipping_claim_%' or p.proname in ('shipping_record_pdc_event','shipping_record_claim_pdc_event','shipping_record_pdc_event_outbound','shipping_pdc_identity_guard') or p.proname like 'after_sales_claim_%reverse%') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.proname in ('shipping_claim_schedule','shipping_claim_dispatch','shipping_claim_take','shipping_claim_finish','shipping_claim_view','shipping_claim_operation','shipping_claim_label_take','shipping_claim_label_finish','shipping_claim_read_label','shipping_record_pdc_event') then execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $$;
-- Newly created wrappers otherwise inherit PostgreSQL PUBLIC EXECUTE.
revoke all on function public.after_sales_claim_staff_action(uuid,uuid,integer,text,jsonb),public.after_sales_claim_customer_action(uuid,uuid,integer,text,jsonb),public.after_sales_claim_detail(uuid,uuid,boolean,uuid),public.after_sales_claim_next(text),public.after_sales_claim_actions(text) from public,anon,authenticated,service_role;
grant execute on function public.after_sales_claim_staff_action(uuid,uuid,integer,text,jsonb),public.after_sales_claim_customer_action(uuid,uuid,integer,text,jsonb),public.after_sales_claim_detail(uuid,uuid,boolean,uuid) to service_role;
commit;
