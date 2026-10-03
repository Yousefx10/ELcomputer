begin;

-- Provider ownership, credential revisions and connectivity are independent.
alter table public.site_settings add column erp_state_version bigint not null default 0;
alter table public.erp_provider_settings add column credential_revision bigint not null default 1;
alter table public.site_settings add column daftra_tested_revision bigint;
alter table public.customer_orders add column erp_owner text not null default 'built_in'
  check (erp_owner in ('built_in', 'daftra'));
-- Preserve known external ownership without exporting unlinked historical orders.
update public.customer_orders orders set erp_owner='daftra'
  where exists(select 1 from public.erp_entity_links links where links.provider='daftra'
    and links.local_entity_type='customer_order' and links.local_id=orders.id
    and links.external_entity_type='invoice');
alter table public.commerce_order_returns add column erp_provider text not null default 'built_in'
  check (erp_provider in ('built_in', 'daftra'));
alter table public.commerce_order_returns add column erp_action_status text not null default 'completed'
  check (erp_action_status in ('completed', 'manual_required'));

create function public.get_active_erp_mode() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select erp_mode from public.site_settings where key = 'default'), 'built_in');
$$;
create function public.assert_built_in_erp() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- A shared row lock prevents a mode transition during a local transaction.
  perform 1 from public.site_settings where key = 'default' for share;
  if public.get_active_erp_mode() <> 'built_in' then
    raise exception using errcode = '42501', message = 'This operation is managed in Daftra.';
  end if;
end;
$$;

create table public.erp_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'daftra' check (provider = 'daftra'),
  status text not null default 'review' check (status in ('review','queued','processing','completed','failed')),
  manifest jsonb not null,
  state_version bigint not null,
  actor_id uuid references public.admin_users(id) on delete set null,
  result jsonb not null default '{}',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.erp_inventory_cache (
  local_entity_type text not null check (local_entity_type in ('product','product_variant')),
  local_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  external_id text not null,
  quantity integer not null check (quantity >= 0),
  cost numeric(12,2) not null check (cost >= 0),
  fetched_at timestamptz not null,
  primary key (local_entity_type,local_id),
  unique (external_id)
);
create table public.erp_stock_reservations (
  order_item_id uuid primary key references public.customer_order_items(id) on delete cascade,
  local_entity_type text not null,
  local_id uuid not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index erp_stock_reservations_local_idx on public.erp_stock_reservations(local_entity_type,local_id);
create table public.erp_worker_leases (
  provider text primary key check (provider = 'daftra'),
  token uuid,
  expires_at timestamptz
);
insert into public.erp_worker_leases(provider) values ('daftra');
create table public.erp_remote_writes (
  operation text not null,
  local_id uuid not null,
  state text not null check (state in ('submitted','confirmed')),
  external_id text,
  created_at timestamptz not null default now(),
  primary key(operation, local_id)
);
alter table public.erp_sync_jobs add column lease_token uuid;
alter table public.erp_sync_jobs add column sync_run_id uuid references public.erp_sync_runs(id);

-- Private connector data stays service-only, including costs and creation intents.
do $$ declare t text; begin
  foreach t in array array['erp_sync_runs','erp_inventory_cache','erp_stock_reservations','erp_worker_leases','erp_remote_writes'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $$;

create function public.erp_guard_local_mutation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_built_in_erp();
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
do $$ declare t text; begin
  foreach t in array array[
    'commerce_procurement_orders','commerce_procurement_items','commerce_sales_orders','commerce_sales_items',
    'commerce_warehouses','commerce_warehouse_inventory','commerce_inventory_movements',
    'commerce_warehouse_transfers','commerce_warehouse_transfer_items','commerce_serialized_inventory_batches',
    'treasury_transactions','hr_employees'
  ] loop
    execute format('create trigger erp_owner_guard before insert or update or delete on public.%I for each row execute function public.erp_guard_local_mutation()',t);
    execute format('create trigger erp_owner_truncate_guard before truncate on public.%I for each statement execute function public.erp_guard_local_mutation()',t);
  end loop;
end $$;

create function public.erp_guard_catalog_inventory() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.get_active_erp_mode() <> 'daftra' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception using errcode='42501', message='ERP inventory records are retained while Daftra is active.';
  end if;
  if tg_op = 'INSERT' then
    if new.stock_quantity <> 0 or coalesce(new.cost_price,0) <> 0 then
      raise exception using errcode='42501', message='Inventory quantity and cost are managed in Daftra.';
    end if;
  elsif new.stock_quantity is distinct from old.stock_quantity or new.cost_price is distinct from old.cost_price
    or (tg_table_name='products' and to_jsonb(new)->'is_serialized' is distinct from to_jsonb(old)->'is_serialized')
    or (tg_table_name='product_variants' and to_jsonb(new)->'product_id' is distinct from to_jsonb(old)->'product_id')
    or (tg_table_name = 'products' and (to_jsonb(new)->'primary_warehouse_id' is distinct from to_jsonb(old)->'primary_warehouse_id'
      or to_jsonb(new)->'default_supplier_id' is distinct from to_jsonb(old)->'default_supplier_id')) then
    raise exception using errcode='42501', message='Inventory quantity, cost and warehouse are managed in Daftra.';
  end if;
  return new;
end;
$$;
create trigger a_erp_inventory_guard before insert or update or delete on public.products for each row execute function public.erp_guard_catalog_inventory();
create trigger a_erp_inventory_guard before insert or update or delete on public.product_variants for each row execute function public.erp_guard_catalog_inventory();

create function public.erp_guard_supplier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (case when tg_op='DELETE' then old.account_type else new.account_type end)='supplier'
    or (tg_op='UPDATE' and old.account_type='supplier') then perform public.assert_built_in_erp(); end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger erp_owner_guard before insert or update or delete on public.commerce_crm_accounts for each row execute function public.erp_guard_supplier();

create function public.erp_guard_physical_units() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.get_active_erp_mode()='daftra' then
    if auth.role()='service_role' and current_setting('app.erp_fulfilment_write',true)='on' then
      if tg_table_name='commerce_serialized_unit_movements' and tg_op='INSERT' then return new; end if;
      if tg_table_name='commerce_serialized_units' and tg_op='UPDATE'
        and (to_jsonb(new) - array['status','customer_order_id','customer_order_item_id','customer_user_id','sold_at','returned_at','updated_at'])
          = (to_jsonb(old) - array['status','customer_order_id','customer_order_item_id','customer_user_id','sold_at','returned_at','updated_at']) then return new; end if;
    end if;
    raise exception using errcode='42501', message='Serialized ERP operations require manual Daftra completion.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger a_erp_owner_guard before insert or update or delete on public.commerce_serialized_units for each row execute function public.erp_guard_physical_units();
create trigger a_erp_owner_guard before insert on public.commerce_serialized_unit_movements for each row execute function public.erp_guard_physical_units();

-- Browser settings writes cannot activate a provider or manufacture a test result.
create function public.erp_guard_provider_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' and (
    (tg_op='UPDATE' and (new.erp_mode is distinct from old.erp_mode
      or new.daftra_connection_status is distinct from old.daftra_connection_status
      or new.daftra_last_checked_at is distinct from old.daftra_last_checked_at
      or new.daftra_connected_at is distinct from old.daftra_connected_at
      or new.daftra_connection_error is distinct from old.daftra_connection_error
      or new.daftra_tested_revision is distinct from old.daftra_tested_revision
      or new.erp_state_version is distinct from old.erp_state_version))
    or (tg_op='INSERT' and (new.erp_mode <> 'built_in' or new.daftra_connection_status <> 'disconnected'))
    or tg_op='DELETE'
  ) then raise exception using errcode='42501', message='Use the ERP settings API.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger erp_state_truncate_guard before truncate on public.site_settings for each statement execute function public.erp_guard_local_mutation();
create trigger erp_state_guard before insert or update or delete on public.site_settings for each row execute function public.erp_guard_provider_state();

create function public.erp_guard_return_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    new.erp_provider:=public.get_active_erp_mode();
    new.erp_action_status:=case when new.erp_provider='daftra' then 'manual_required' else 'completed' end;
  elsif old.erp_provider='daftra' then
    if tg_op='DELETE' or new.erp_provider is distinct from old.erp_provider
      or new.erp_action_status is distinct from old.erp_action_status then
      raise exception 'Complete external returns manually in Daftra.';
    end if;
  elsif public.get_active_erp_mode()='daftra' then
    raise exception 'Built-in return history is retained while Daftra is active.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger erp_return_state_guard before insert or update or delete on public.commerce_order_returns
  for each row execute function public.erp_guard_return_state();

create function public.erp_stamp_order_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then new.erp_owner:=public.get_active_erp_mode();
  elsif new.erp_owner is distinct from old.erp_owner then raise exception 'The order ERP owner cannot change.'; end if;
  return new;
end;
$$;
create trigger a_erp_order_owner before insert or update on public.customer_orders for each row execute function public.erp_stamp_order_owner();

create or replace function public.enqueue_daftra_order_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.get_active_erp_mode()<>'daftra' or new.erp_owner<>'daftra' or new.is_preorder then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload)
  values('order.export','customer_order',new.id,'daftra:order:'||new.id::text||':status:'||new.status,jsonb_build_object('order_status',new.status))
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;

-- Only a public stock projection is exposed. Costs/credentials stay private.
create function public.erp_storefront_stock(p_type text,p_id uuid,p_fallback integer) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare q integer; physical integer; product uuid;
  can_read_private boolean:=coalesce(auth.role()='service_role',false) or coalesce(public.has_admin_permission('products.view'),false);
begin
  if public.get_active_erp_mode()<>'daftra' then return p_fallback; end if;
  select c.quantity-coalesce((select sum(r.quantity)::integer from public.erp_stock_reservations r
    where r.local_entity_type=c.local_entity_type and r.local_id=c.local_id),0),c.product_id
  into q,product from public.erp_inventory_cache c where c.local_entity_type=p_type and c.local_id=p_id;
  if q is null and p_type='product' and exists(select 1 from public.products where id=p_id and is_serialized and (is_published or can_read_private)) then
    select coalesce(sum(public.erp_storefront_stock('product_variant',v.id,0)),0)::integer into q
      from public.product_variants v where v.product_id=p_id and v.is_active;
    return q;
  end if;
  if q is null then return 0; end if;
  if not exists(select 1 from public.products p where p.id=product and (p.is_published or can_read_private)) then return 0; end if;
  if p_type='product_variant' and not exists(select 1 from public.product_variants v
    where v.id=p_id and v.product_id=product and v.is_active) then return 0; end if;
  if exists(select 1 from public.products p where p.id=product and p.is_serialized) then
    select count(*)::integer into physical from public.commerce_serialized_units u
      join public.products p on p.id=u.product_id
      where u.product_id=product and u.status='in_stock' and u.warehouse_id=p.primary_warehouse_id
        and (p_type='product' or u.variant_id=p_id);
    q:=least(q,physical);
  end if;
  return greatest(q,0);
end;
$$;
-- These views retain the base-table RLS and catalog foreign-key identities.
do $$ declare cols text; t text; entity text; begin
  foreach t in array array['products','product_variants'] loop
    entity:=case when t='products' then 'product' else 'product_variant' end;
    select string_agg(case when a.attname='stock_quantity'
      then format('public.erp_storefront_stock(%L,p.id,p.stock_quantity) as stock_quantity',entity)
      else format('p.%I',a.attname) end,',' order by a.attnum) into cols
    from pg_attribute a where a.attrelid=('public.'||t)::regclass and a.attnum>0 and not a.attisdropped;
    execute format('create view public.storefront_%I with (security_invoker=true) as select %s from public.%I p',t,cols,t);
    execute format('grant select on public.storefront_%I to anon,authenticated,service_role',t);
  end loop;
end $$;

create function public.erp_save_daftra_credentials(p_admin_id uuid,p_url text,p_key text,p_client text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_url text;
begin
  if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users a where a.id=p_admin_id and a.is_active and (a.role='owner' or coalesce((a.permissions->>'settings.edit')::boolean,false))) then raise exception 'Not authorized'; end if;
  perform 1 from public.site_settings where key='default' for update;
  if exists(select 1 from public.erp_worker_leases where expires_at>clock_timestamp()) then raise exception 'Wait for the current ERP job to finish.'; end if;
  select account_url into old_url from public.erp_provider_settings where id='daftra';
  if old_url is distinct from p_url and old_url is not null and (exists(select 1 from public.erp_entity_links) or exists(select 1 from public.erp_remote_writes)) then raise exception 'Account changes require manual mapping reconciliation.'; end if;
  insert into public.erp_provider_settings(id,account_url,api_key_encrypted,client_id_encrypted,updated_by,updated_at)
  values('daftra',p_url,p_key,p_client,p_admin_id,clock_timestamp())
  on conflict(id) do update set account_url=excluded.account_url,api_key_encrypted=excluded.api_key_encrypted,
    client_id_encrypted=excluded.client_id_encrypted,credential_revision=public.erp_provider_settings.credential_revision+1,updated_by=p_admin_id,updated_at=excluded.updated_at;
  update public.site_settings set daftra_connection_status='disconnected',daftra_last_checked_at=null,
    daftra_connected_at=null,daftra_connection_error=null,daftra_tested_revision=null,erp_state_version=erp_state_version+1,updated_at=clock_timestamp() where key='default';
end;
$$;

create function public.erp_record_daftra_test(p_revision bigint,p_success boolean,p_checked_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.site_settings where key='default' for update;
  if coalesce((select credential_revision from public.erp_provider_settings where id='daftra'),0)<>p_revision then raise exception 'Credentials changed. Test the connection again.'; end if;
  update public.site_settings set daftra_connection_status=case when p_success then 'connected' else 'error' end,
    daftra_last_checked_at=p_checked_at,daftra_connected_at=case when p_success then p_checked_at else null end,
    daftra_connection_error=case when p_success then null else 'Daftra connection test failed.' end,
    daftra_tested_revision=p_revision,erp_state_version=erp_state_version+1,updated_at=clock_timestamp() where key='default';
end;
$$;

create function public.erp_change_mode(p_admin_id uuid,p_mode text,p_expected_version bigint,p_choice text,p_review_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.site_settings%rowtype; run public.erp_sync_runs%rowtype; a public.admin_users%rowtype; job_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.'; end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not (a.role='owner' or coalesce((a.permissions->>'settings.edit')::boolean,false)) then raise exception 'Not authorized'; end if;
  select * into s from public.site_settings where key='default' for update;
  if not found or s.erp_state_version<>p_expected_version then raise exception 'ERP settings changed. Reload and review again.'; end if;
  if p_mode not in ('built_in','daftra') or p_choice not in ('switch_only','synchronize','without_import') then raise exception 'Choose a valid ERP transition.'; end if;
  if p_mode=s.erp_mode then return jsonb_build_object('mode',s.erp_mode); end if;
  if exists(select 1 from public.erp_worker_leases where expires_at>clock_timestamp()) then raise exception 'Wait for the current ERP job to finish.'; end if;
  if p_mode='daftra' then
    if p_choice not in ('switch_only','synchronize') then raise exception 'Choose a Daftra activation option.'; end if;
    if s.daftra_connection_status<>'connected' or s.daftra_tested_revision is distinct from coalesce((select credential_revision from public.erp_provider_settings where id='daftra'),0) then raise exception 'Test the saved Daftra credentials before activation.'; end if;
    if p_choice='synchronize' then
      select * into run from public.erp_sync_runs where id=p_review_id for update;
      if not found or run.status<>'review' or run.actor_id is distinct from p_admin_id or run.state_version<>s.erp_state_version
        or run.created_at<clock_timestamp()-interval '30 minutes' or run.manifest->>'operation' is distinct from 'inventory.import' then raise exception 'A current synchronization review is required.'; end if;
      update public.erp_sync_runs set status='queued',updated_at=clock_timestamp() where id=run.id;
      insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload,sync_run_id)
        values('inventory.import','sync_run',run.id,'daftra:run:'||run.id,jsonb_build_object('direction','daftra_to_elcomputer'),run.id) returning id into job_id;
    end if;
  elsif p_choice<>'without_import' then raise exception 'Switch back without import is required.'; end if;
  update public.site_settings set erp_mode=p_mode,erp_state_version=erp_state_version+1,updated_at=clock_timestamp() where key='default';
  insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'settings.erp.mode-update',
      'Changed the active ERP provider.',jsonb_build_object('previousMode',s.erp_mode,'mode',p_mode,'choice',p_choice,'syncRunId',run.id));
  return jsonb_build_object('mode',p_mode,'syncRunId',run.id,'jobId',job_id);
end;
$$;

-- One provider lease prevents concurrent client/item/invoice creation.
drop function public.claim_daftra_sync_job(uuid);
create function public.claim_daftra_sync_job(p_job_id uuid default null,p_operations text[] default null)
returns setof public.erp_sync_jobs language plpgsql security definer set search_path = '' as $$
declare v_token uuid:=gen_random_uuid(); lease public.erp_worker_leases%rowtype;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then return; end if;
  insert into public.erp_worker_leases(provider) values('daftra') on conflict(provider) do nothing;
  select * into lease from public.erp_worker_leases where provider='daftra' for update;
  if lease.expires_at>clock_timestamp() then return; end if;
  update public.erp_sync_jobs set status='failed',last_error='Worker interrupted. Reconciliation may be required.',locked_at=null,lease_token=null,available_at=clock_timestamp()
    where provider='daftra' and status='processing';
  return query with candidate as (
    select j.id from public.erp_sync_jobs j where j.provider='daftra' and j.status in ('pending','failed')
      and j.attempts<j.max_attempts and j.available_at<=clock_timestamp() and (p_job_id is null or j.id=p_job_id)
      and (p_operations is null or j.operation=any(p_operations))
      order by j.created_at,j.id for update skip locked limit 1
  ) update public.erp_sync_jobs j set status='processing',attempts=j.attempts+1,locked_at=clock_timestamp(),lease_token=v_token,updated_at=clock_timestamp()
    from candidate c where j.id=c.id returning j.*;
  if found then
    update public.erp_worker_leases set token=v_token,expires_at=clock_timestamp()+interval '30 minutes' where provider='daftra';
    update public.erp_sync_runs set status='processing',updated_at=clock_timestamp()
      where id in (select sync_run_id from public.erp_sync_jobs where lease_token=v_token);
  end if;
end;
$$;
revoke all on function public.claim_daftra_sync_job(uuid,text[]) from public,anon,authenticated;
grant execute on function public.claim_daftra_sync_job(uuid,text[]) to service_role;
-- Avoid PL/pgSQL ambiguity between the variable and lease column.
create function public.erp_finish_daftra_job(p_job_id uuid,p_token uuid,p_success boolean,p_result jsonb,p_error text,p_delay integer)
returns void language plpgsql security definer set search_path = '' as $$
declare job public.erp_sync_jobs%rowtype;
begin
  select * into job from public.erp_sync_jobs where id=p_job_id for update;
  if not found or job.status<>'processing' or job.lease_token is distinct from p_token then raise exception 'ERP worker lease was lost.'; end if;
  update public.erp_sync_jobs set status=case when p_success then 'completed' else 'failed' end,
    result=coalesce(p_result,'{}'),last_error=case when p_success then null else p_error end,
    available_at=clock_timestamp()+make_interval(secs=>greatest(0,least(coalesce(p_delay,60),3600))),
    completed_at=case when p_success then clock_timestamp() else null end,locked_at=null,lease_token=null,updated_at=clock_timestamp() where id=p_job_id;
  update public.erp_worker_leases set token=null,expires_at=null where provider='daftra' and token=p_token;
  if job.sync_run_id is not null then update public.erp_sync_runs set status=case when p_success then 'completed' else 'failed' end,
    result=coalesce(p_result,'{}'),last_error=case when p_success then null else p_error end,updated_at=clock_timestamp() where id=job.sync_run_id; end if;
end;
$$;
create function public.erp_validate_worker_lease(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.get_active_erp_mode()<>'daftra' or not exists(select 1 from public.erp_worker_leases
    where provider='daftra' and token=p_token and expires_at>clock_timestamp()+interval '20 seconds') then
    raise exception 'ERP worker lease was lost.';
  end if;
end;
$$;
create function public.erp_retry_daftra_job(p_job_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  update public.erp_sync_jobs set status='pending',attempts=0,available_at=clock_timestamp(),last_error=null,updated_at=clock_timestamp()
    where id=p_job_id and provider='daftra' and status='failed';
  if not found then raise exception 'Only failed jobs can be retried.'; end if;
  return p_job_id;
end;
$$;

create function public.erp_apply_inventory_cache(p_rows jsonb,p_fetched_at timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare r jsonb; count_rows integer:=0; product uuid;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  for r in select value from jsonb_array_elements(p_rows) order by value->>'product_id',value->>'local_id' loop
    product:=(r->>'product_id')::uuid;
    perform 1 from public.products where id=product for update;
    if not found then raise exception 'The mapped product no longer exists.'; end if;
    if r->>'local_entity_type'='product' and (r->>'local_id')::uuid<>product then raise exception 'Invalid product mapping.'; end if;
    if r->>'local_entity_type'='product_variant' and not exists(select 1 from public.product_variants where id=(r->>'local_id')::uuid and product_id=product) then raise exception 'Invalid variant mapping.'; end if;
    insert into public.erp_inventory_cache(local_entity_type,local_id,product_id,external_id,quantity,cost,fetched_at)
    values(r->>'local_entity_type',(r->>'local_id')::uuid,product,r->>'external_id',(r->>'quantity')::integer,(r->>'cost')::numeric,p_fetched_at)
    on conflict(local_entity_type,local_id) do update set external_id=excluded.external_id,quantity=excluded.quantity,cost=excluded.cost,fetched_at=excluded.fetched_at
      where public.erp_inventory_cache.fetched_at<=excluded.fetched_at;
    insert into public.erp_entity_links(provider,local_entity_type,local_id,external_entity_type,external_id,external_number,metadata,last_synced_at,updated_at)
      values('daftra',r->>'local_entity_type',(r->>'local_id')::uuid,'product',r->>'external_id',r->>'code','{"source":"inventory-import"}',clock_timestamp(),clock_timestamp())
      on conflict(provider,local_entity_type,local_id) do update set last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at
        where public.erp_entity_links.external_id=excluded.external_id;
    if not found then raise exception 'ERP item mapping conflicts with an existing link.'; end if;
    -- Clear only after processed invoice stock transactions were verified,
    -- followed by this later authoritative product-balance fetch.
    delete from public.erp_stock_reservations reservations using public.customer_order_items items,public.erp_entity_links links
      where reservations.order_item_id=items.id and items.order_id=links.local_id
        and links.provider='daftra' and links.local_entity_type='customer_order'
        and links.metadata->>'daftraDraft'='false' and (links.metadata->>'stockVerifiedAt')::timestamptz<p_fetched_at
        and reservations.local_entity_type=r->>'local_entity_type' and reservations.local_id=(r->>'local_id')::uuid;
    count_rows:=count_rows+1;
  end loop;
  return count_rows;
end;
$$;

-- Reuses the established checkout validation, pricing and cart idempotency.
create or replace function public.erp_create_external_customer_order(
  p_user_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_allow_out_of_stock boolean,
  p_cart_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_order public.customer_orders%rowtype;
  v_order public.customer_orders%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_coupon public.site_coupons%rowtype;
  v_unit public.commerce_serialized_units%rowtype;
  v_item jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_coupon_code text;
  v_order_number text;
  v_available_units integer;
  v_assigned_units integer;
  v_total_assigned_units integer := 0;
  v_updated_rows integer;
  v_warehouse_quantity integer;
  v_has_warehouse_inventory boolean;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.'; end if;
  if p_user_id is null or not exists (
    select 1
    from auth.users as users
    where users.id = p_user_id
  ) then
    raise exception 'A valid signed-in customer is required.';
  end if;

  -- A cart retry must return before coupon, inventory, or order writes. The
  -- advisory lock closes the race between two simultaneous requests.
  if p_cart_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_user_id::text || ':' || p_cart_id::text,
        0
      )
    );

    select orders.*
    into v_existing_order
    from public.customer_orders as orders
    where orders.user_id = p_user_id
      and orders.checkout_cart_id = p_cart_id
    limit 1;

    if found then
      return jsonb_build_object(
        'order', to_jsonb(v_existing_order),
        'created', false,
        'serialized_units_assigned', 0
      );
    end if;
  end if;

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'A valid order is required.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one order item is required.';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'An order cannot contain more than 100 item lines.';
  end if;

  if nullif(btrim(p_order ->> 'first_name'), '') is null
    or nullif(btrim(p_order ->> 'phone'), '') is null
    or nullif(btrim(p_order ->> 'street_address'), '') is null
    or nullif(btrim(p_order ->> 'city'), '') is null
    or nullif(btrim(p_order ->> 'governorate'), '') is null
  then
    raise exception 'Complete customer and delivery details are required.';
  end if;

  -- Lock products in a deterministic order. Prices, snapshots, and availability
  -- are derived here instead of trusting browser-submitted line totals.
  for v_item in
    select item_rows.value
    from jsonb_array_elements(p_items) as item_rows(value)
    order by
      item_rows.value ->> 'product_id',
      coalesce(item_rows.value ->> 'variant_id', '')
  loop
    v_product_id := nullif(btrim(v_item ->> 'product_id'), '')::uuid;
    v_variant_id := nullif(btrim(v_item ->> 'variant_id'), '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_product_id is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'Every order line requires a valid product and quantity.';
    end if;

    select products.*
    into v_product
    from public.products as products
    where products.id = v_product_id
    for update;

    if not found or not v_product.is_published or v_product.selling_mode <> 'normal' then
      raise exception 'One or more products are no longer available.';
    end if;

    if public.erp_storefront_stock(case when v_product.is_serialized then 'product_variant' else 'product' end,
      coalesce(v_variant_id,v_product_id),0)<v_quantity
      and (v_product.is_serialized or not coalesce(p_allow_out_of_stock,false)) then
      raise exception 'Not enough cached Daftra stock is available.';
    end if;
    if v_product.is_serialized then
      if v_variant_id is null then
        raise exception 'A product model is required for serialized inventory.';
      end if;

      if v_product.primary_warehouse_id is null then
        raise exception 'The serialized product does not have a primary warehouse.';
      end if;

      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.id = v_variant_id
        and variants.product_id = v_product_id
        and variants.is_active
      for update;

      if not found then
        raise exception 'The selected product model is no longer available.';
      end if;

      select count(*)::integer
      into v_available_units
      from public.commerce_serialized_units as units
      where units.product_id = v_product_id
        and units.variant_id = v_variant_id
        and units.warehouse_id = v_product.primary_warehouse_id
        and units.status = 'in_stock';

      if v_available_units < v_quantity then
        raise exception
          'Not enough serialized units are available for one of the selected models.';
      end if;

      -- Variants currently represent color/model identity, while the product
      -- owns the storefront price. This also prevents stale copied prices when
      -- an admin changes the parent product price.
      v_unit_price := round(coalesce(v_product.price, 0)::numeric, 2);
    else
      if v_variant_id is not null then
        raise exception 'Standard products cannot be ordered with a variant.';
      end if;

      if not coalesce(p_allow_out_of_stock, false)
        and public.erp_storefront_stock('product',v_product.id,0) < v_quantity
      then
        raise exception 'One or more products do not have enough stock.';
      end if;

      v_unit_price := round(coalesce(v_product.price, 0)::numeric, 2);
    end if;

    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);
    v_subtotal := round((v_subtotal + v_line_total)::numeric, 2);

    v_normalized_items := v_normalized_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'variant_id', case
          when v_product.is_serialized then v_variant.id
          else null
        end,
        'product_title', v_product.title,
        'product_slug', v_product.slug,
        'image_url', v_product.image_url,
        'variant_name', case
          when v_product.is_serialized then v_variant.name
          else null
        end,
        'variant_code', case
          when v_product.is_serialized then v_variant.code
          else null
        end,
        'variant_sku', case
          when v_product.is_serialized then v_variant.sku
          else null
        end,
        'variant_color_name', case
          when v_product.is_serialized then v_variant.color_name
          else null
        end,
        'variant_color_hex', case
          when v_product.is_serialized then v_variant.color_hex
          else null
        end,
        'is_serialized', v_product.is_serialized,
        'primary_warehouse_id', v_product.primary_warehouse_id,
        'unit_cost', coalesce(
          case
            when v_product.is_serialized then v_variant.cost_price
            else v_product.cost_price
          end,
          0
        ),
        'unit_price', v_unit_price,
        'quantity', v_quantity,
        'line_total', v_line_total
      )
    );
  end loop;

  v_coupon_code := upper(nullif(btrim(p_order ->> 'coupon_code'), ''));

  if v_coupon_code is not null then
    select coupons.*
    into v_coupon
    from public.site_coupons as coupons
    where upper(coupons.code) = v_coupon_code
    for update;

    if not found
      or not v_coupon.is_active
      or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
      or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
      or v_subtotal < v_coupon.minimum_order_amount
      or (
        v_coupon.usage_limit is not null
        and v_coupon.usage_count >= v_coupon.usage_limit
      )
    then
      raise exception 'The coupon is no longer valid for this order.';
    end if;

    if v_coupon.discount_type = 'percentage' then
      v_discount := least(
        v_subtotal,
        round(
          (v_subtotal * v_coupon.discount_value / 100)::numeric,
          2
        )
      );
    else
      v_discount := least(
        v_subtotal,
        round(v_coupon.discount_value::numeric, 2)
      );
    end if;
  end if;

  v_total := round(greatest(v_subtotal - v_discount, 0)::numeric, 2);
  v_order_number := coalesce(
    nullif(btrim(p_order ->> 'order_number'), ''),
    'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))
  );

  insert into public.customer_orders (
    user_id,
    checkout_cart_id,
    order_number,
    status,
    first_name,
    last_name,
    email,
    phone,
    street_address,
    city,
    governorate,
    shipping_method,
    payment_method,
    subtotal_amount,
    discount_amount,
    coupon_code,
    total_amount,
    currency,
    updated_at
  )
  values (
    p_user_id,
    p_cart_id,
    v_order_number,
    'pending_payment',
    btrim(p_order ->> 'first_name'),
    nullif(btrim(p_order ->> 'last_name'), ''),
    nullif(btrim(p_order ->> 'email'), ''),
    btrim(p_order ->> 'phone'),
    btrim(p_order ->> 'street_address'),
    btrim(p_order ->> 'city'),
    btrim(p_order ->> 'governorate'),
    nullif(btrim(p_order ->> 'shipping_method'), ''),
    nullif(btrim(p_order ->> 'payment_method'), ''),
    v_subtotal,
    v_discount,
    case when v_coupon_code is not null then v_coupon.code else null end,
    v_total,
    coalesce(nullif(btrim(p_order ->> 'currency'), ''), 'EGP'),
    now()
  )
  returning * into v_order;

  perform set_config('app.erp_fulfilment_write','on',true);

  for v_item in
    select item_rows.value
    from jsonb_array_elements(v_normalized_items) as item_rows(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_line_total := (v_item ->> 'line_total')::numeric;
    if public.erp_storefront_stock(case when v_variant_id is not null then 'product_variant' else 'product' end,
      coalesce(v_variant_id,v_product_id),0)<v_quantity
      and (v_variant_id is not null or not coalesce(p_allow_out_of_stock,false)) then
      raise exception 'Not enough cached Daftra stock remained available.';
    end if;

    insert into public.customer_order_items (
      order_id,
      product_id,
      variant_id,
      product_title,
      product_slug,
      image_url,
      variant_name,
      variant_code,
      variant_sku,
      variant_color_name,
      variant_color_hex,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_order.id,
      v_product_id,
      v_variant_id,
      v_item ->> 'product_title',
      nullif(v_item ->> 'product_slug', ''),
      nullif(v_item ->> 'image_url', ''),
      nullif(v_item ->> 'variant_name', ''),
      nullif(v_item ->> 'variant_code', ''),
      nullif(v_item ->> 'variant_sku', ''),
      nullif(v_item ->> 'variant_color_name', ''),
      nullif(v_item ->> 'variant_color_hex', ''),
      v_unit_price,
      v_quantity,
      v_line_total
    )
    returning * into v_order_item;

    if (v_item ->> 'is_serialized')::boolean then
      v_assigned_units := 0;

      for v_unit in
        select units.*
        from public.commerce_serialized_units as units
        where units.product_id = v_product_id
          and units.variant_id = v_variant_id
          and units.warehouse_id =
            (v_item ->> 'primary_warehouse_id')::uuid
          and units.status = 'in_stock'
        order by units.created_at, units.id
        limit v_quantity
        for update
      loop
        update public.commerce_serialized_units
        set
          status = 'sold',
          customer_order_id = v_order.id,
          customer_order_item_id = v_order_item.id,
          customer_user_id = p_user_id,
          sold_at = now(),
          returned_at = null,
          updated_at = now()
        where id = v_unit.id;

        insert into public.commerce_serialized_unit_movements (
          unit_id,
          product_id,
          variant_id,
          warehouse_id,
          customer_order_id,
          movement_type,
          from_status,
          to_status,
          notes
        )
        values (
          v_unit.id,
          v_product_id,
          v_variant_id,
          (v_item ->> 'primary_warehouse_id')::uuid,
          v_order.id,
          'sold',
          'in_stock',
          'sold',
          'Assigned during atomic online checkout.'
        );

        v_assigned_units := v_assigned_units + 1;
      end loop;

      if v_assigned_units <> v_quantity then
        raise exception
          'Not enough serialized units remained available during checkout.';
      end if;

      v_total_assigned_units := v_total_assigned_units + v_assigned_units;
    end if;
    -- Platform reservations leave all built-in balances and costing untouched.
    if public.erp_storefront_stock(case when v_variant_id is not null then 'product_variant' else 'product' end,
      coalesce(v_variant_id,v_product_id),0)<v_quantity and v_variant_id is null and not coalesce(p_allow_out_of_stock,false) then
      raise exception 'Not enough cached Daftra stock remained available.';
    end if;
    insert into public.erp_stock_reservations(order_item_id,local_entity_type,local_id,quantity)
      values(v_order_item.id,case when v_variant_id is not null then 'product_variant' else 'product' end,
        coalesce(v_variant_id,v_product_id),v_quantity);
  end loop;
  perform set_config('app.erp_fulfilment_write','off',true);

  if v_coupon_code is not null then
    update public.site_coupons
    set
      usage_count = usage_count + 1,
      updated_at = now()
    where id = v_coupon.id;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'created', true,
    'serialized_units_assigned', v_total_assigned_units
  );
end;
$function$;

-- Preserve the existing built-in implementation and selling-mode checks.
alter function public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid) rename to commerce_create_builtin_customer_order;
create function public.commerce_create_customer_order(p_user_id uuid,p_order jsonb,p_items jsonb,p_allow_out_of_stock boolean,p_cart_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()='daftra' then
    return public.erp_create_external_customer_order(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
  end if;
  return public.commerce_create_builtin_customer_order(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
end;
$$;

-- Reject direct calls to the old checkout/release/return RPCs in external mode.
-- These signatures retain their original caller grants and permission checks.
do $$ declare r record; body text; begin
  for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'commerce_create_builtin_customer_order','commerce_create_normal_customer_order',
      'commerce_release_preorder','commerce_return_serialized_unit',
      'commerce_create_procurement_order','commerce_create_sales_order','commerce_transfer_inventory',
      'treasury_record_supplier_payment','treasury_record_customer_receipt','treasury_record_salary_payment'
    ) loop
    body:=pg_get_functiondef(r.oid);
    -- All listed established functions are PL/pgSQL, with a single leading begin.
    body:=regexp_replace(body,'(\m[Bb][Ee][Gg][Ii][Nn]\M)',E'\\1\n  perform public.assert_built_in_erp();','');
    execute body;
  end loop;
end $$;

alter function public.commerce_create_order_return(uuid,uuid,text,text,jsonb) rename to commerce_create_builtin_order_return;
do $$ declare body text; begin
  body:=pg_get_functiondef('public.commerce_create_builtin_order_return(uuid,uuid,text,text,jsonb)'::regprocedure);
  execute regexp_replace(body,'(\m[Bb][Ee][Gg][Ii][Nn]\M)',E'\\1\n  perform public.assert_built_in_erp();','');
end $$;
create function public.commerce_create_order_return(p_order_id uuid,p_warehouse_id uuid,p_reason text,p_notes text,p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid; row jsonb; item public.customer_order_items%rowtype; qty integer; previous integer; total integer:=0;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()='built_in' then
    return public.commerce_create_builtin_order_return(p_order_id,p_warehouse_id,p_reason,p_notes,p_items);
  end if;
  if not public.is_active_admin() then raise exception 'Not authorized'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Valid return items are required.'; end if;
  insert into public.commerce_order_returns(order_id,warehouse_id,reason,notes,created_by,erp_provider,erp_action_status)
    values(p_order_id,p_warehouse_id,p_reason,p_notes,auth.uid(),'daftra','manual_required') returning id into rid;
  for row in select value from jsonb_array_elements(p_items) loop
    qty:=(row->>'quantity')::integer;
    select * into item from public.customer_order_items where id=(row->>'order_item_id')::uuid and order_id=p_order_id for update;
    if not found or qty is null or qty<1 then raise exception 'Invalid return item.'; end if;
    select coalesce(sum(i.quantity),0) into previous from public.commerce_order_return_items i
      join public.commerce_order_returns r on r.id=i.order_return_id where r.order_id=p_order_id and i.order_item_id=item.id;
    if qty+previous>item.quantity then raise exception 'Returned quantity exceeds the order quantity.'; end if;
    insert into public.commerce_order_return_items(order_return_id,order_item_id,product_id,quantity,unit_price)
      values(rid,item.id,item.product_id,qty,item.unit_price);
    total:=total+qty;
  end loop;
  update public.commerce_order_returns set total_items=total where id=rid;
  return rid;
end;
$$;

create function public.erp_record_external_unit_return(p_unit_id uuid,p_warehouse_id uuid,p_reason text,p_notes text,p_admin_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u public.commerce_serialized_units%rowtype; rid uuid;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' or not exists(select 1 from public.admin_users a where a.id=p_admin_id and a.is_active and (a.role='owner' or coalesce((a.permissions->>'products.edit')::boolean,false))) then raise exception 'Not authorized'; end if;
  select * into u from public.commerce_serialized_units where id=p_unit_id for update;
  if not found or u.status<>'sold' or u.customer_order_item_id is null then raise exception 'A sold website item is required.'; end if;
  select i.order_return_id into rid from public.commerce_order_return_items i where i.serialized_unit_id=p_unit_id;
  if found then return rid; end if;
  insert into public.commerce_order_returns(order_id,warehouse_id,reason,notes,total_items,created_by,erp_provider,erp_action_status)
    values(u.customer_order_id,p_warehouse_id,p_reason,p_notes,1,p_admin_id,'daftra','manual_required') returning id into rid;
  insert into public.commerce_order_return_items(order_return_id,order_item_id,product_id,quantity,unit_price,serialized_unit_id)
    select rid,u.customer_order_item_id,u.product_id,1,i.unit_price,u.id from public.customer_order_items i where i.id=u.customer_order_item_id;
  return rid;
end;
$$;

-- All mutation helpers introduced here are private service RPCs.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname in (
      'erp_save_daftra_credentials','erp_record_daftra_test','erp_change_mode','erp_finish_daftra_job',
      'erp_retry_daftra_job','erp_apply_inventory_cache','erp_create_external_customer_order','erp_record_external_unit_return',
      'erp_validate_worker_lease',
      'commerce_create_customer_order','commerce_create_builtin_customer_order','commerce_create_normal_customer_order'
    )) loop
    execute format('revoke all on function %s from public,anon,authenticated',r.signature);
    execute format('grant execute on function %s to service_role',r.signature);
  end loop;
end $$;
-- The existing browser return RPC keeps staff authorization and never restocks in Daftra mode.
grant execute on function public.commerce_create_order_return(uuid,uuid,text,text,jsonb) to authenticated;
revoke all on function public.commerce_create_builtin_order_return(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.commerce_create_builtin_order_return(uuid,uuid,text,text,jsonb) to service_role;

create function public.erp_finalize_inventory_cache(p_external_ids text[],p_fetched_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  update public.erp_inventory_cache set quantity=0,fetched_at=p_fetched_at
    where not (external_id=any(p_external_ids)) and fetched_at<=p_fetched_at;
end;
$$;
create function public.erp_queue_inventory_refresh() returns uuid
language plpgsql security definer set search_path = '' as $$
declare job_id uuid;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('daftra:inventory',0));
  select id into job_id from public.erp_sync_jobs where operation='inventory.import'
    and (status in ('pending','processing') or status='failed' and attempts<max_attempts) order by created_at limit 1;
  if found then return job_id; end if;
  -- At most one refresh per five minutes across manual and scheduled requests.
  select id into job_id from public.erp_sync_jobs where operation='inventory.import'
    and created_at>clock_timestamp()-interval '5 minutes' order by created_at desc limit 1;
  if found then return job_id; end if;
  insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload)
    values('inventory.import','inventory',gen_random_uuid(),'daftra:inventory:'||gen_random_uuid(),'{"direction":"daftra_to_elcomputer"}') returning id into job_id;
  return job_id;
end;
$$;
revoke all on function public.erp_finalize_inventory_cache(text[],timestamptz) from public,anon,authenticated;
revoke all on function public.erp_queue_inventory_refresh() from public,anon,authenticated;
grant execute on function public.erp_finalize_inventory_cache(text[],timestamptz) to service_role;
grant execute on function public.erp_queue_inventory_refresh() to service_role;

-- Extend the existing reset allowlist; never implicitly cascade into connector data.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_erp_ownership;
create function public.system_reset_tables(p_scope text) returns text[]
language plpgsql immutable set search_path = '' as $$
declare tables text[]:=public.system_reset_tables_before_erp_ownership(p_scope); pos integer;
begin
  if p_scope='full' then
    pos:=array_position(tables,'erp_provider_settings');
    tables:=tables[1:pos]||array['erp_sync_runs','erp_worker_leases','erp_remote_writes']||tables[pos+1:cardinality(tables)];
  end if;
  if p_scope in ('orders','commerce','full') then
    pos:=array_position(tables,'shipping_webhook_events');
    tables:=tables[1:pos-1]||array['erp_stock_reservations']||tables[pos:cardinality(tables)];
  end if;
  if p_scope in ('products','commerce','full') then
    pos:=array_position(tables,'commerce_serialized_unit_movements');
    tables:=tables[1:pos-1]||array['erp_inventory_cache']||tables[pos:cardinality(tables)];
  end if;
  return tables;
end;
$$;
revoke all on function public.system_reset_tables_before_erp_ownership(text) from public,anon,authenticated;
revoke all on function public.system_reset_tables(text) from public,anon,authenticated;
-- A reset suspends application triggers; guard the RPC before it can do so.
do $$ declare body text; begin
  body:=pg_get_functiondef('public.system_reset_begin(uuid,text,uuid,jsonb)'::regprocedure);
  execute regexp_replace(body,'(\m[Bb][Ee][Gg][Ii][Nn]\M)',E'\\1\n  if p_scope in (''products'',''commerce'',''content'',''full'') then perform public.assert_built_in_erp(); end if;','');
end $$;
notify pgrst, 'reload schema';

commit;
