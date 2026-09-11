begin;

-- Service-only reset journal. No passwords or access tokens are stored here.
create table if not exists public.system_reset_runs (
  id uuid primary key,
  owner_id uuid not null,
  scope text not null,
  status text not null check (status in ('cleanup_pending', 'completed')),
  actor jsonb not null,
  summary jsonb not null,
  manifest jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists system_reset_one_pending on public.system_reset_runs ((true)) where status = 'cleanup_pending';
create table if not exists public.system_reset_attempts (
  owner_id uuid primary key,
  window_started_at timestamptz not null,
  attempts integer not null
);
alter table public.system_reset_runs enable row level security;
alter table public.system_reset_attempts enable row level security;
revoke all on public.system_reset_runs, public.system_reset_attempts from public, anon, authenticated;
grant select on public.system_reset_runs to service_role;

create or replace function public.system_reset_tables(p_scope text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
  case p_scope
    when 'products' then return array['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories']::text[];
    when 'orders' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders']::text[];
    when 'commerce' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders']::text[];
    when 'documents' then return array['document_folder_permissions', 'documents', 'document_folders']::text[];
    when 'media' then return array[]::text[];
    when 'content' then return array['site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings']::text[];
    when 'analytics' then return array['store_analytics_events', 'store_analytics_sessions', 'nps_responses']::text[];
    when 'full' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_folder_permissions', 'documents', 'document_folders', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;
revoke all on function public.system_reset_tables(text) from public, anon, authenticated;

create or replace function public.system_reset_assert_owner(p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server authorization required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admin_users where id = p_owner and role = 'owner' and is_active) then
    raise exception 'Active owner access required.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.system_reset_assert_owner(uuid) from public, anon, authenticated;

create or replace function public.system_reset_check_attempt(p_owner uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  perform public.system_reset_assert_owner(p_owner);
  insert into public.system_reset_attempts as attempts (owner_id, window_started_at, attempts)
  values (p_owner, clock_timestamp(), 1)
  on conflict (owner_id) do update set
    attempts = case when attempts.window_started_at < clock_timestamp() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_started_at = case when attempts.window_started_at < clock_timestamp() - interval '15 minutes' then clock_timestamp() else attempts.window_started_at end
  returning attempts into v_count;
  return v_count <= 5;
end;
$$;
revoke all on function public.system_reset_check_attempt(uuid) from public, anon, authenticated;
grant execute on function public.system_reset_check_attempt(uuid) to service_role;

create or replace function public.system_reset_plan(p_owner uuid, p_scope text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tables text[] := public.system_reset_tables(p_scope);
  v_table text;
  v_count bigint;
  v_counts jsonb := '{}';
  v_blockers jsonb := '[]';
  v_fk record;
  v_predicate text;
  v_unknown text[];
begin
  perform public.system_reset_assert_owner(p_owner);
  if p_scope = 'full' then
    select array_agg(c.relname) into v_unknown
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not c.relname = any(v_tables || array['admin_users', 'system_reset_runs', 'system_reset_attempts']);
    if cardinality(v_unknown) > 0 then
      raise exception 'Unrecognized tables found. Update the reset scope before continuing.' using errcode = 'P0001';
    end if;
  end if;
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      v_counts := v_counts || jsonb_build_object(v_table, v_count);
    end if;
  end loop;
  -- Never silently cascade into data outside the selected scope.
  for v_fk in
    select con.*, src.relname as source_name, ns.nspname as source_schema
    from pg_constraint con
    join pg_class target on target.oid = con.confrelid
    join pg_namespace tn on tn.oid = target.relnamespace
    join pg_class src on src.oid = con.conrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    where con.contype = 'f' and tn.nspname = 'public' and target.relname = any(v_tables)
      and not (ns.nspname = 'public' and src.relname = any(v_tables))
      and con.confdeltype <> 'n'
  loop
    select string_agg(format('%I is not null', a.attname), ' and ') into v_predicate
    from pg_attribute a where a.attrelid = v_fk.conrelid and a.attnum = any(v_fk.conkey);
    execute format('select count(*) from %I.%I where %s', v_fk.source_schema, v_fk.source_name, v_predicate) into v_count;
    if v_count > 0 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('table', v_fk.source_name, 'count', v_count));
    end if;
  end loop;
  if p_scope = 'full' then
    select count(*) into v_count from auth.users where id <> p_owner;
    v_counts := v_counts || jsonb_build_object('other_user_accounts', v_count);
  end if;
  return jsonb_build_object('counts', v_counts, 'blockers', v_blockers);
end;
$$;
revoke all on function public.system_reset_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.system_reset_plan(uuid, text) to service_role;

create or replace function public.system_reset_begin(p_owner uuid, p_scope text, p_id uuid, p_media_files jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '10s' set statement_timeout = '120s' as $$
declare
  v_tables text[] := public.system_reset_tables(p_scope);
  v_remaining text[];
  v_table text;
  v_trigger record;
  v_triggers jsonb := '[]';
  v_restore jsonb;
  v_plan jsonb;
  v_actor jsonb;
  v_run public.system_reset_runs%rowtype;
  v_manifest jsonb := jsonb_build_object('media', p_media_files, 'documents', '[]'::jsonb, 'users', '[]'::jsonb);
  v_column record;
begin
  perform public.system_reset_assert_owner(p_owner);
  if not pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset', 0)) then
    raise exception 'Another reset is running.';
  end if;
  select * into v_run from public.system_reset_runs where id = p_id for update;
  if found then
    if v_run.owner_id <> p_owner or v_run.scope <> p_scope then raise exception 'Reset request does not match.'; end if;
    return to_jsonb(v_run);
  end if;
  if exists (select 1 from public.system_reset_runs where status = 'cleanup_pending') then
    raise exception 'Finish the pending reset before starting another.';
  end if;
  -- Exclusive locks prevent concurrent changes between the dependency check and deletion.
  for v_table in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname <> all(array['system_reset_runs', 'system_reset_attempts']) order by c.relname
  loop
    execute format('lock table public.%I in access exclusive mode', v_table);
  end loop;
  v_plan := public.system_reset_plan(p_owner, p_scope);
  if jsonb_array_length(v_plan->'blockers') > 0 then
    raise exception 'Linked records prevent this reset. Review the affected data first.';
  end if;
  select jsonb_build_object('name', coalesce(nullif(full_name, ''), email), 'email', email) into v_actor
    from public.admin_users where id = p_owner;
  if p_scope in ('documents', 'full') and to_regclass('storage.objects') is not null then
    select jsonb_set(v_manifest, '{documents}', coalesce(jsonb_agg(name), '[]')) into v_manifest
      from storage.objects where bucket_id = 'admin-documents';
  end if;
  if p_scope = 'full' then
    select jsonb_set(v_manifest, '{users}', coalesce(jsonb_agg(id), '[]')) into v_manifest from auth.users where id <> p_owner;
  end if;
  insert into public.system_reset_runs (id, owner_id, scope, status, actor, summary, manifest)
    values (p_id, p_owner, p_scope, 'cleanup_pending', v_actor, v_plan->'counts', v_manifest);
  -- Flush deferred constraint events before changing trigger state. Keep FK checks immediate.
  set constraints all immediate;
  -- Only application triggers are suspended, inside this transaction. FK constraints stay active.
  -- Their original enabled/replica/always states are restored before commit, or rolled back on error.
  for v_trigger in
    select t.tgname, t.tgenabled, c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal and t.tgenabled <> 'D'
      and c.relname = any(v_tables || case when p_scope = 'media' then array['products', 'product_variants', 'product_images', 'categories', 'brands', 'site_settings', 'site_hero_banners', 'site_offer_cards', 'customer_order_items'] else array[]::text[] end)
  loop
    v_triggers := v_triggers || jsonb_build_array(to_jsonb(v_trigger));
    execute format('alter table public.%I disable trigger %I', v_trigger.relname, v_trigger.tgname);
  end loop;
  if 'customer_orders' = any(v_tables) and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customer_orders' and column_name = 'awaiting_customer_message_id') then
    update public.customer_orders set awaiting_customer_message_id = null;
  end if;
  select array_agg(t) into v_remaining from unnest(v_tables) t where to_regclass(format('public.%I', t)) is not null;
  while cardinality(v_remaining) > 0 loop
    select candidate into v_table from unnest(v_remaining) candidate
    where not exists (
      select 1 from pg_constraint fk join pg_class child on child.oid = fk.conrelid
      where fk.contype = 'f' and fk.confrelid = to_regclass(format('public.%I', candidate))
        and child.relname = any(v_remaining) and fk.conrelid <> fk.confrelid
        and fk.conname <> 'customer_orders_awaiting_customer_message_fkey'
    ) limit 1;
    if v_table is null then raise exception 'Unresolved reset dependency. No data was erased.'; end if;
    execute format('delete from public.%I', v_table);
    v_remaining := array_remove(v_remaining, v_table);
  end loop;
  if p_scope = 'commerce' then
    perform set_config('app.serialized_inventory_write', 'on', true);
    update public.products set stock_quantity = 0, cost_price = 0;
    if to_regclass('public.product_variants') is not null then
      update public.product_variants set stock_quantity = 0, cost_price = 0;
    end if;
  end if;
  if p_scope = 'media' then
    for v_column in select table_name, column_name from information_schema.columns
      where table_schema = 'public' and data_type in ('text', 'character varying')
        and table_name = any(array['products', 'product_variants', 'product_images', 'categories', 'brands', 'site_settings', 'site_hero_banners', 'site_offer_cards', 'customer_order_items'])
        and column_name = any(array['image_url', 'logo_url', 'site_logo_url', 'banner_ad_1_image_url', 'banner_ad_2_image_url'])
    loop
      execute format('update public.%I set %I = %L where %I like %L', v_column.table_name, v_column.column_name, '', v_column.column_name, '/uploads/%');
    end loop;
  end if;
  if p_scope = 'full' then
    delete from public.admin_users where id <> p_owner;
    delete from public.system_reset_runs where id <> p_id;
    delete from public.system_reset_attempts where owner_id <> p_owner;
    if to_regclass('public.store_analytics_internal_users') is not null then
      insert into public.store_analytics_internal_users(user_id) values (p_owner) on conflict do nothing;
    end if;
    if to_regclass('public.commerce_serialized_unit_code_seq') is not null then
      alter sequence public.commerce_serialized_unit_code_seq restart with 1;
    end if;
  end if;
  for v_restore in select value from jsonb_array_elements(v_triggers) loop
    execute format('alter table public.%I enable %s trigger %I', v_restore->>'relname',
      case v_restore->>'tgenabled' when 'A' then 'always' when 'R' then 'replica' else '' end, v_restore->>'tgname');
  end loop;
  select * into v_run from public.system_reset_runs where id = p_id;
  return to_jsonb(v_run);
end;
$$;
revoke all on function public.system_reset_begin(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.system_reset_begin(uuid, text, uuid, jsonb) to service_role;

create or replace function public.system_reset_finish(p_owner uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_run public.system_reset_runs%rowtype;
begin
  perform public.system_reset_assert_owner(p_owner);
  select * into v_run from public.system_reset_runs where id = p_id and owner_id = p_owner for update;
  if not found then raise exception 'Reset request not found.'; end if;
  if v_run.status <> 'completed' then
    -- This is intentionally inserted AFTER all database, file and account cleanup.
    insert into public.admin_activity_logs (admin_user_id, author_name, author_email, author_role, action_key, description, metadata, created_at)
      values (p_owner, v_run.actor->>'name', v_run.actor->>'email', 'owner', 'settings.system_reset.completed',
        format('%s completed the %s reset.', v_run.actor->>'name', v_run.scope),
        jsonb_build_object('reset_id', p_id, 'scope', v_run.scope, 'records', v_run.summary), clock_timestamp());
    update public.system_reset_runs set status = 'completed', completed_at = clock_timestamp(), manifest = '{}' where id = p_id returning * into v_run;
  end if;
  return jsonb_build_object('id', v_run.id, 'scope', v_run.scope, 'status', v_run.status, 'completed_at', v_run.completed_at);
end;
$$;
revoke all on function public.system_reset_finish(uuid, uuid) from public, anon, authenticated;
grant execute on function public.system_reset_finish(uuid, uuid) to service_role;

commit;
