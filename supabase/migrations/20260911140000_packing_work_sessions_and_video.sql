begin;

create table if not exists public.order_packing_work_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null
    references public.admin_users (id) on delete restrict,
  operator_name text not null,
  operator_email text,
  camera_label text,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_packing_work_sessions_status_check
    check (status in ('active', 'closed')),
  constraint order_packing_work_sessions_operator_name_check
    check (length(btrim(operator_name)) between 1 and 160),
  constraint order_packing_work_sessions_operator_email_check
    check (operator_email is null or length(btrim(operator_email)) <= 320),
  constraint order_packing_work_sessions_camera_label_check
    check (camera_label is null or length(btrim(camera_label)) <= 300),
  constraint order_packing_work_sessions_closed_check
    check (
      (status = 'active' and closed_at is null)
      or (status = 'closed' and closed_at is not null)
    )
);

create unique index if not exists order_packing_work_sessions_active_admin_uidx
  on public.order_packing_work_sessions (admin_user_id)
  where status = 'active';

create index if not exists order_packing_work_sessions_admin_started_idx
  on public.order_packing_work_sessions (admin_user_id, started_at desc);

alter table public.order_packing_sessions
  add column if not exists work_session_id uuid
    references public.order_packing_work_sessions (id) on delete restrict;

create index if not exists order_packing_sessions_work_session_idx
  on public.order_packing_sessions (work_session_id, created_at desc);

create table if not exists public.order_packing_videos (
  id uuid primary key default gen_random_uuid(),
  packing_session_id uuid not null
    references public.order_packing_sessions (id) on delete restrict,
  work_session_id uuid not null
    references public.order_packing_work_sessions (id) on delete restrict,
  order_id uuid not null
    references public.customer_orders (id) on delete restrict,
  recorded_by uuid not null
    references public.admin_users (id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  duration_seconds numeric(12, 3),
  status text not null default 'uploading',
  recording_started_at timestamptz not null,
  recording_ended_at timestamptz not null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_packing_videos_session_uidx unique (packing_session_id),
  constraint order_packing_videos_status_check
    check (status in ('uploading', 'ready', 'failed')),
  constraint order_packing_videos_file_name_check
    check (length(btrim(file_name)) between 1 and 240),
  constraint order_packing_videos_storage_path_check
    check (length(btrim(storage_path)) between 1 and 500),
  constraint order_packing_videos_mime_check
    check (mime_type in ('video/webm', 'video/mp4', 'video/quicktime')),
  constraint order_packing_videos_size_check
    check (size_bytes is null or size_bytes between 1 and 524288000),
  constraint order_packing_videos_duration_check
    check (duration_seconds is null or duration_seconds >= 0),
  constraint order_packing_videos_time_check
    check (recording_ended_at >= recording_started_at),
  constraint order_packing_videos_ready_check
    check (
      status <> 'ready'
      or (
        size_bytes is not null
        and uploaded_at is not null
      )
    )
);

create index if not exists order_packing_videos_order_created_idx
  on public.order_packing_videos (order_id, created_at desc);

create or replace function public.validate_order_packing_work_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.admin_user_id is distinct from old.admin_user_id
      or new.operator_name is distinct from old.operator_name
      or new.operator_email is distinct from old.operator_email
      or new.started_at is distinct from old.started_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Packing work session identity is immutable.';
    end if;

    if old.status = 'closed' then
      raise exception 'A closed packing work session cannot be changed.';
    end if;

    if old.status = 'active' and new.status not in ('active', 'closed') then
      raise exception 'The packing work session status is not valid.';
    end if;

    if new.status = 'closed' and exists (
      select 1
      from public.order_packing_sessions as packing
      where packing.admin_user_id = old.admin_user_id
        and packing.status = 'active'
    ) then
      raise exception 'Release or complete the active order before closing this session.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists order_packing_work_sessions_validate
  on public.order_packing_work_sessions;

create trigger order_packing_work_sessions_validate
before update or delete
on public.order_packing_work_sessions
for each row
execute function public.validate_order_packing_work_session();

create or replace function public.require_order_packing_work_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_work_session public.order_packing_work_sessions%rowtype;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if new.work_session_id is null then
    raise exception 'Start a packing session before choosing an order.';
  end if;

  select work_sessions.*
  into v_work_session
  from public.order_packing_work_sessions as work_sessions
  where work_sessions.id = new.work_session_id;

  if not found or v_work_session.status <> 'active' then
    raise exception 'Your packing session is closed. Start a new session.';
  end if;

  if v_work_session.admin_user_id is distinct from new.admin_user_id then
    raise exception 'This packing session belongs to another operator.';
  end if;

  return new;
end;
$$;

drop trigger if exists order_packing_sessions_require_work_session
  on public.order_packing_sessions;

create trigger order_packing_sessions_require_work_session
before insert or update of work_session_id, status
on public.order_packing_sessions
for each row
execute function public.require_order_packing_work_session();

create or replace function public.require_order_packing_video()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'completed' and new.status = 'completed' and not exists (
    select 1
    from public.order_packing_videos as videos
    where videos.packing_session_id = new.id
      and videos.order_id = new.order_id
      and videos.recorded_by = new.admin_user_id
      and videos.work_session_id = new.work_session_id
      and videos.status = 'ready'
  ) then
    raise exception 'Upload the packing video before completing this order.';
  end if;

  return new;
end;
$$;

drop trigger if exists order_packing_sessions_require_video
  on public.order_packing_sessions;

create trigger order_packing_sessions_require_video
before update of status
on public.order_packing_sessions
for each row
execute function public.require_order_packing_video();

alter table public.order_packing_work_sessions enable row level security;
alter table public.order_packing_videos enable row level security;

revoke all on table public.order_packing_work_sessions from public, anon, authenticated;
revoke all on table public.order_packing_videos from public, anon, authenticated;
grant select, insert, update on table public.order_packing_work_sessions to service_role;
grant select, insert, update on table public.order_packing_videos to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-packing-videos',
  'order-packing-videos',
  false,
  524288000,
  array['video/webm', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.system_reset_tables(p_scope text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
  case p_scope
    when 'products' then return array['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories']::text[];
    when 'orders' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders']::text[];
    when 'commerce' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders']::text[];
    when 'documents' then return array['document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders']::text[];
    when 'media' then return array[]::text[];
    when 'content' then return array['site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings']::text[];
    when 'analytics' then return array['store_analytics_events', 'store_analytics_sessions', 'nps_responses']::text[];
    when 'full' then return array['erp_sync_jobs', 'erp_entity_links', 'shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.system_reset_tables(text) from public, anon, authenticated;

commit;
