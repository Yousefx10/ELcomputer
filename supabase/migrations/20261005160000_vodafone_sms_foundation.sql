-- Local-only SMS foundation. Private tables and service-role-only atomic jobs.
begin;
create or replace function public.default_admin_permissions() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'dashboard.view',false,'dashboard.analysis',false,'dashboard.orders',false,
    'products.view',false,'products.add',false,'products.edit',false,
    'categories.view',false,'categories.add',false,'categories.edit',false,
    'brands.view',false,'brands.add',false,'brands.edit',false,'reviews.view',false,'reviews.delete',false,
    'settings.view',false,'settings.edit',false,'settings.coupons',false,'users.view',false,'hr.view',false,'hr.edit',false,
    'treasury.view',false,'treasury.edit',false,'documents.view',false,'documents.manage',false,
    'pages.view',false,'pages.edit',false,'help.view',false,'help.edit',false,
    'support.view',false,'support.reply',false,'support.manage',false,
    'sms.view',false,'sms.settings.view',false,'sms.settings.manage',false,'sms.templates.view',false,
    'sms.templates.manage',false,'sms.history.view',false,'sms.notification.send',false,'sms.campaign.send',false
  );
$$;
create table public.sms_provider_settings (
  id text primary key check (id = 'vodafone'),
  is_enabled boolean not null default false,
  api_mode text not null default 'production' check (api_mode = 'production'),
  base_url text not null default '', port integer check (port between 1 and 65535),
  account_id_encrypted text, password_encrypted text, hash_secret_encrypted text,
  notification_path text not null default '/web2sms/sms/submit/Notification',
  campaign_path text not null default '/web2sms/sms/submit',
  sender_names text[] not null default '{}', default_sender text not null default '',
  expected_outbound_ip text not null default '', trusted_ip_confirmed boolean not null default false,
  activation_confirmed boolean not null default false, hash_protocol_confirmed boolean not null default false,
  activation_notes text not null default '',
  timeout_ms integer not null default 10000 check (timeout_ms between 1000 and 30000),
  preflight_retry_limit integer not null default 2 check (preflight_retry_limit between 0 and 3),
  batch_size integer not null default 50 check (batch_size between 1 and 200),
  request_interval_ms integer not null default 1000 check (request_interval_ms between 500 and 60000),
  default_country text not null default 'EG' check (default_country in ('EG','explicit')),
  allow_international boolean not null default false,
  config_revision integer not null default 0, next_request_at timestamptz,
  updated_by uuid references public.admin_users(id) on delete set null, updated_at timestamptz not null default now(),
  check (notification_path <> campaign_path),
  check (not is_enabled or (base_url <> '' and account_id_encrypted is not null and password_encrypted is not null
    and hash_secret_encrypted is not null and default_sender = any(sender_names) and expected_outbound_ip <> ''
    and trusted_ip_confirmed and activation_confirmed and hash_protocol_confirmed))
);
insert into public.sms_provider_settings(id) values ('vodafone');

create table public.sms_templates (
  id uuid primary key default gen_random_uuid(), code text unique not null check (code ~ '^[a-z][a-z0-9_]{1,79}$'),
  name text not null check (length(name) between 1 and 100), category text not null default 'manual' check (length(category) between 1 and 50),
  text_en text not null default '' check (length(text_en) <= 4000), text_ar text not null default '' check (length(text_ar) <= 4000),
  traffic_type text not null check (traffic_type in ('notification','campaign')), is_enabled boolean not null default false,
  sender text not null default '', variables text[] not null default '{}',
  created_by uuid references public.admin_users(id) on delete set null, updated_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (length(text_en) > 0 or length(text_ar) > 0)
);
create table public.sms_batches (
  id uuid primary key default gen_random_uuid(), provider text not null default 'vodafone' references public.sms_provider_settings(id),
  idempotency_key text unique not null check (length(idempotency_key) between 1 and 200),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  external_trx_id text unique not null default ('ELC-' || gen_random_uuid()::text),
  traffic_type text not null check (traffic_type in ('notification','campaign')),
  template_id uuid references public.sms_templates(id),
  triggered_by uuid references public.admin_users(id) on delete set null,
  trigger_source text not null check (length(trigger_source) between 1 and 80),
  priority integer not null default 10 check (priority between 0 and 100), expires_at timestamptz,
  status text not null default 'queued' check (status in ('queued','processing','submitted','partial','failed','uncertain')),
  attempts integer not null default 0, available_at timestamptz not null default now(),
  lease_token uuid, locked_at timestamptz, dispatch_started_at timestamptz,
  result_status text, error_code integer, failure_category text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), submitted_at timestamptz
);
create index sms_batches_queue on public.sms_batches(priority desc, available_at, created_at) where status = 'queued';
create index sms_batches_history on public.sms_batches(created_at desc);
create index sms_batches_actor on public.sms_batches(triggered_by, created_at desc);
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.sms_batches(id) on delete cascade,
  position integer not null check (position >= 0), recipient text not null check (recipient ~ '^\+[1-9][0-9]{5,14}$'),
  body text not null check (length(body) between 1 and 4000), sender text not null check (length(sender) between 1 and 50),
  encoding text not null check (encoding in ('gsm7','utf16')), units integer not null check (units > 0), segments integer not null check (segments > 0),
  status text not null default 'queued' check (status in ('queued','processing','submitted','failed','uncertain')),
  provider_status text check (provider_status in ('SUBMITTED','FAILED_TO_SUBMITTED','SUSPENDED','INVALID')),
  error_code integer, failure_category text, submitted_at timestamptz,
  created_at timestamptz not null default now(), unique(batch_id, position), unique(batch_id, recipient)
);
create table public.sms_attempts (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.sms_batches(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0), external_trx_id text not null,
  status text not null check (status in ('processing','submitted','partial','failed','uncertain','preflight_failed')),
  result_status text, error_code integer, failure_category text,
  started_at timestamptz not null default now(), finished_at timestamptz, unique(batch_id, attempt_number)
);
create index sms_messages_batch on public.sms_messages(batch_id);
create index sms_attempts_batch on public.sms_attempts(batch_id);

do $$ declare t text; begin
  foreach t in array array['sms_provider_settings','sms_templates','sms_batches','sms_messages','sms_attempts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

-- Transactional enqueue, content-bound idempotency and persistent manual quotas.
create function public.sms_enqueue(p_batch jsonb, p_messages jsonb) returns jsonb
language plpgsql security definer set search_path = public,pg_temp as $$
declare existing public.sms_batches%rowtype; config public.sms_provider_settings%rowtype;
  batch public.sms_batches%rowtype; actor uuid := nullif(p_batch->>'triggered_by','')::uuid;
  msg jsonb; n integer := jsonb_array_length(p_messages); i integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_batch->>'idempotency_key',0));
  select * into existing from public.sms_batches where idempotency_key=p_batch->>'idempotency_key';
  if found then
    if existing.fingerprint <> p_batch->>'fingerprint' then raise exception 'SMS idempotency conflict'; end if;
    return jsonb_build_object('id',existing.id,'status',existing.status,'external_trx_id',existing.external_trx_id,'reused',true);
  end if;
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  if not config.is_enabled then raise exception 'SMS provider disabled'; end if;
  if n < 1 or n > config.batch_size or (p_batch->>'traffic_type'='notification' and n<>1) then raise exception 'Invalid SMS batch'; end if;
  if (p_batch->>'expires_at')::timestamptz <= clock_timestamp() then raise exception 'SMS expiry is in the past'; end if;
  if actor is not null and (select count(*) from public.sms_batches where triggered_by=actor and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'SMS rate limit'; end if;
  if actor is not null and p_batch->>'traffic_type'='campaign' and exists(select 1 from public.sms_batches where triggered_by=actor and traffic_type='campaign' and created_at>clock_timestamp()-interval '1 minute') then raise exception 'SMS campaign rate limit'; end if;
  insert into public.sms_batches(idempotency_key,fingerprint,traffic_type,template_id,triggered_by,trigger_source,priority,expires_at)
    values(p_batch->>'idempotency_key',p_batch->>'fingerprint',p_batch->>'traffic_type',nullif(p_batch->>'template_id','')::uuid,
      actor,p_batch->>'trigger_source',coalesce((p_batch->>'priority')::integer,10),(p_batch->>'expires_at')::timestamptz) returning * into batch;
  for msg in select value from jsonb_array_elements(p_messages) loop
    if not ((msg->>'sender') = any(config.sender_names)) then raise exception 'Invalid SMS sender'; end if;
    insert into public.sms_messages(batch_id,position,recipient,body,sender,encoding,units,segments)
      values(batch.id,i,msg->>'recipient',msg->>'body',msg->>'sender',msg->>'encoding',(msg->>'units')::integer,(msg->>'segments')::integer);
    i := i+1;
  end loop;
  return jsonb_build_object('id',batch.id,'status',batch.status,'external_trx_id',batch.external_trx_id,'reused',false);
end $$;

-- One provider POST at a time; stale leases never automatically resend.
create function public.sms_claim() returns public.sms_batches
language plpgsql security definer set search_path = public,pg_temp as $$
declare config public.sms_provider_settings%rowtype; job public.sms_batches%rowtype;
begin
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  with stale as (
    update public.sms_batches set status='uncertain',failure_category='worker_interrupted',updated_at=clock_timestamp(),lease_token=null
    where status='processing' and locked_at<clock_timestamp()-interval '2 minutes' returning id
  ) update public.sms_messages set status='uncertain',failure_category='worker_interrupted' where batch_id in(select id from stale);
  update public.sms_attempts a set status='uncertain',failure_category='worker_interrupted',finished_at=clock_timestamp()
    from public.sms_batches b where a.batch_id=b.id and b.status='uncertain' and a.status='processing';
  with expired as (
    update public.sms_batches set status='failed',failure_category='expired',updated_at=clock_timestamp()
    where status='queued' and expires_at<=clock_timestamp() returning id
  ) update public.sms_messages set status='failed',failure_category='expired' where batch_id in(select id from expired);
  if not config.is_enabled or config.next_request_at>clock_timestamp() or exists(select 1 from public.sms_batches where status='processing') then return null; end if;
  select * into job from public.sms_batches where status='queued' and available_at<=clock_timestamp()
    order by priority desc,created_at,id limit 1 for update skip locked;
  if not found then return null; end if;
  update public.sms_batches set status='processing',locked_at=clock_timestamp(),lease_token=gen_random_uuid(),updated_at=clock_timestamp()
    where id=job.id returning * into job;
  update public.sms_messages set status='processing' where batch_id=job.id;
  update public.sms_provider_settings set next_request_at=clock_timestamp()+config.request_interval_ms*interval '1 millisecond' where id='vodafone';
  return job;
end $$;

create function public.sms_begin_dispatch(p_id uuid,p_token uuid,p_revision integer) returns boolean
language plpgsql security definer set search_path = public,pg_temp as $$
declare config public.sms_provider_settings%rowtype; job public.sms_batches%rowtype;
begin
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  select * into job from public.sms_batches where id=p_id for update;
  if job.status<>'processing' or job.lease_token is distinct from p_token or job.dispatch_started_at is not null then raise exception 'SMS lease lost'; end if;
  if not config.is_enabled or config.config_revision<>p_revision then
    update public.sms_batches set status='queued',lease_token=null,locked_at=null,updated_at=clock_timestamp() where id=p_id;
    update public.sms_messages set status='queued' where batch_id=p_id;
    return false;
  end if;
  if job.expires_at<=clock_timestamp() then
    update public.sms_batches set status='failed',failure_category='expired',lease_token=null,updated_at=clock_timestamp() where id=p_id;
    update public.sms_messages set status='failed',failure_category='expired' where batch_id=p_id;
    return false;
  end if;
  update public.sms_batches set attempts=attempts+1,dispatch_started_at=clock_timestamp() where id=p_id returning * into job;
  insert into public.sms_attempts(batch_id,attempt_number,external_trx_id,status) values(p_id,job.attempts,job.external_trx_id,'processing');
  return true;
end $$;

create function public.sms_finish(p_id uuid,p_token uuid,p_result jsonb) returns void
language plpgsql security definer set search_path = public,pg_temp as $$
declare job public.sms_batches%rowtype; state text:=p_result->>'status'; msg jsonb; i integer:=0; max_retry integer;
begin
  select * into job from public.sms_batches where id=p_id for update;
  if job.status<>'processing' or job.lease_token is distinct from p_token then raise exception 'SMS lease lost'; end if;
  if state='preflight_failed' then
    select preflight_retry_limit into max_retry from public.sms_provider_settings where id='vodafone';
    state:=case when job.attempts<=max_retry and (job.expires_at is null or job.expires_at>clock_timestamp()+interval '30 seconds') then 'queued' else 'failed' end;
  elsif state not in ('submitted','partial','failed','uncertain') then raise exception 'Invalid SMS result'; end if;
  if p_result->'messages' is not null and jsonb_array_length(p_result->'messages')<>(select count(*) from public.sms_messages where batch_id=p_id) then raise exception 'Invalid SMS result count'; end if;
  update public.sms_batches set status=state,result_status=p_result->>'result_status',error_code=(p_result->>'error_code')::integer,
    failure_category=p_result->>'category',updated_at=clock_timestamp(),submitted_at=case when state in ('submitted','partial') then clock_timestamp() end,
    available_at=case when state='queued' then clock_timestamp()+interval '30 seconds' else available_at end,
    lease_token=null,locked_at=null,dispatch_started_at=case when state='queued' then null else dispatch_started_at end where id=p_id;
  update public.sms_attempts set status=p_result->>'status',result_status=p_result->>'result_status',error_code=(p_result->>'error_code')::integer,
    failure_category=p_result->>'category',finished_at=clock_timestamp() where batch_id=p_id and attempt_number=job.attempts;
  if p_result->'messages' is null then
    update public.sms_messages set status=state,failure_category=p_result->>'category' where batch_id=p_id;
  else
    for msg in select value from jsonb_array_elements(p_result->'messages') loop
      update public.sms_messages set status=msg->>'status',provider_status=msg->>'provider_status',error_code=(msg->>'error_code')::integer,
        failure_category=msg->>'category',submitted_at=case when msg->>'status'='submitted' then clock_timestamp() end where batch_id=p_id and position=i;
      i:=i+1;
    end loop;
  end if;
end $$;

revoke all on function public.sms_enqueue(jsonb,jsonb),public.sms_claim(),public.sms_begin_dispatch(uuid,uuid,integer),public.sms_finish(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sms_enqueue(jsonb,jsonb),public.sms_claim(),public.sms_begin_dispatch(uuid,uuid,integer),public.sms_finish(uuid,uuid,jsonb) to service_role;

-- Preserve the existing explicit full-reset contract. Partial resets leave SMS
-- history/settings alone. No reset is performed by applying this migration.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_sms;
create function public.system_reset_tables(p_scope text) returns text[] language plpgsql immutable set search_path='' as $$
declare tables text[]:=public.system_reset_tables_before_sms(p_scope); pos integer;
begin
  if p_scope='full' then
    pos:=array_position(tables,'product_features');
    tables:=tables[1:pos-1]||array['sms_attempts','sms_messages','sms_batches','sms_templates','sms_provider_settings']||tables[pos:cardinality(tables)];
  end if;
  return tables;
end $$;
revoke all on function public.system_reset_tables(text),public.system_reset_tables_before_sms(text) from public,anon,authenticated;
-- Check after the reset's existing exclusive table locks, preventing a lease race.
do $guard$ declare body text; marker text:='  v_plan := public.system_reset_plan(p_owner, p_scope);'; begin
  body:=pg_get_functiondef('public.system_reset_begin(uuid,text,uuid,jsonb)'::regprocedure);
  if position(marker in body)=0 then raise exception 'Reset guard insertion point missing'; end if;
  execute replace(body,marker,$insert$
  if p_scope='full' and exists(select 1 from public.sms_batches where status='processing') then
    raise exception 'Wait for the SMS worker to finish before resetting.';
  end if;
  v_plan := public.system_reset_plan(p_owner, p_scope);$insert$);
end $guard$;
notify pgrst, 'reload schema';
commit;
