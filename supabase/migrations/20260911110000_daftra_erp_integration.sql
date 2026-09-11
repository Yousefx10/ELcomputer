begin;

alter table public.site_settings
  add column if not exists erp_mode text not null default 'built_in',
  add column if not exists daftra_connection_status text not null default 'disconnected',
  add column if not exists daftra_last_checked_at timestamp with time zone,
  add column if not exists daftra_connected_at timestamp with time zone,
  add column if not exists daftra_connection_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_erp_mode_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_erp_mode_check
      check (erp_mode in ('built_in', 'daftra'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_daftra_connection_status_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_daftra_connection_status_check
      check (daftra_connection_status in ('disconnected', 'connected', 'error'));
  end if;
end;
$$;

create table if not exists public.erp_entity_links (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'daftra',
  local_entity_type text not null,
  local_id uuid not null,
  external_entity_type text not null,
  external_id text not null,
  external_number text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint erp_entity_links_provider_check check (provider = 'daftra')
);

create unique index if not exists erp_entity_links_local_uidx
  on public.erp_entity_links (provider, local_entity_type, local_id);

create unique index if not exists erp_entity_links_external_uidx
  on public.erp_entity_links (provider, external_entity_type, external_id);

create index if not exists erp_entity_links_synced_idx
  on public.erp_entity_links (last_synced_at desc);

create table if not exists public.erp_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'daftra',
  operation text not null,
  local_entity_type text not null,
  local_id uuid not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  available_at timestamp with time zone not null default now(),
  locked_at timestamp with time zone,
  completed_at timestamp with time zone,
  last_error text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint erp_sync_jobs_provider_check check (provider = 'daftra'),
  constraint erp_sync_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint erp_sync_jobs_attempts_check check (attempts >= 0),
  constraint erp_sync_jobs_max_attempts_check check (max_attempts between 1 and 25),
  constraint erp_sync_jobs_dedupe_key_key unique (dedupe_key)
);

create index if not exists erp_sync_jobs_queue_idx
  on public.erp_sync_jobs (status, available_at, created_at);

create index if not exists erp_sync_jobs_local_idx
  on public.erp_sync_jobs (local_entity_type, local_id, created_at desc);

alter table public.erp_entity_links enable row level security;
alter table public.erp_sync_jobs enable row level security;

revoke all on table public.erp_entity_links from anon, authenticated;
revoke all on table public.erp_sync_jobs from anon, authenticated;
grant select, insert, update, delete on table public.erp_entity_links to service_role;
grant select, insert, update, delete on table public.erp_sync_jobs to service_role;

create or replace function public.claim_daftra_sync_job(
  p_job_id uuid default null
)
returns setof public.erp_sync_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select jobs.id
    from public.erp_sync_jobs as jobs
    where jobs.provider = 'daftra'
      and jobs.status in ('pending', 'failed')
      and jobs.attempts < jobs.max_attempts
      and jobs.available_at <= now()
      and (p_job_id is null or jobs.id = p_job_id)
    order by jobs.created_at
    for update skip locked
    limit 1
  )
  update public.erp_sync_jobs as jobs
  set
    status = 'processing',
    attempts = jobs.attempts + 1,
    locked_at = now(),
    last_error = null,
    updated_at = now()
  from candidate
  where jobs.id = candidate.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_daftra_sync_job(uuid) from public;
grant execute on function public.claim_daftra_sync_job(uuid) to service_role;

create or replace function public.enqueue_daftra_order_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := false;
begin
  select coalesce(
    erp_mode = 'daftra' and daftra_connection_status = 'connected',
    false
  )
  into v_enabled
  from public.site_settings
  where key = 'default';

  if not v_enabled then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.erp_sync_jobs (
    operation,
    local_entity_type,
    local_id,
    dedupe_key,
    payload
  )
  values (
    'order.export',
    'customer_order',
    new.id,
    'daftra:order:' || new.id::text || ':status:' || new.status,
    jsonb_build_object('order_status', new.status)
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists customer_orders_enqueue_daftra_sync
  on public.customer_orders;
create trigger customer_orders_enqueue_daftra_sync
after insert or update of status
on public.customer_orders
for each row
execute function public.enqueue_daftra_order_sync();

revoke all on function public.enqueue_daftra_order_sync() from public;
grant execute on function public.enqueue_daftra_order_sync() to service_role;

commit;
