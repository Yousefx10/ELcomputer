begin;

alter table public.customer_orders
add column if not exists payment_status text not null default 'pending',
add column if not exists paid_at timestamptz null,
add column if not exists shipping_review_status text not null default 'not_required';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_orders_payment_status_check'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
    add constraint customer_orders_payment_status_check
    check (payment_status in ('pending', 'paid', 'failed', 'refunded'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_orders_shipping_review_status_check'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
    add constraint customer_orders_shipping_review_status_check
    check (shipping_review_status in ('not_required', 'required', 'approved', 'rejected'));
  end if;
end;
$$;

create table if not exists public.shipping_provider_settings (
  id text primary key,
  display_name text not null,
  base_url text not null,
  company_id text not null,
  product_id integer not null,
  origin_city_id integer null,
  origin_address text null,
  origin_phone text null,
  origin_contact_name text null,
  default_weight_kg numeric(8, 3) not null default 1,
  shipment_type_id integer not null default 1,
  label_template_id integer not null default 1,
  allow_open_shipment boolean not null default false,
  all_must_valid boolean not null default true,
  is_enabled boolean not null default false,
  auto_create_labels boolean not null default false,
  access_token_encrypted text null,
  webhook_secret_encrypted text null,
  updated_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_provider_settings_id_check check (id = 'pdc'),
  constraint shipping_provider_settings_base_url_check check (
    base_url = 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/'
  ),
  constraint shipping_provider_settings_product_check check (product_id > 0),
  constraint shipping_provider_settings_weight_check check (default_weight_kg > 0),
  constraint shipping_provider_settings_shipment_type_check check (shipment_type_id in (1, 3, 5)),
  constraint shipping_provider_settings_template_check check (label_template_id > 0)
);

insert into public.shipping_provider_settings (
  id,
  display_name,
  base_url,
  company_id,
  product_id
)
values (
  'pdc',
  'PDC Courier',
  'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',
  '280533',
  40
)
on conflict (id) do nothing;

create table if not exists public.shipping_city_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pdc',
  provider_city_id integer not null,
  governorate text not null,
  city text not null,
  city_arabic text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_city_mappings_provider_check check (provider = 'pdc'),
  constraint shipping_city_mappings_city_id_check check (provider_city_id > 0)
);

create unique index if not exists shipping_city_mappings_provider_city_uidx
on public.shipping_city_mappings (provider, provider_city_id);

create unique index if not exists shipping_city_mappings_name_uidx
on public.shipping_city_mappings (provider, lower(governorate), lower(city));

create table if not exists public.shipping_status_mappings (
  provider text not null default 'pdc',
  provider_status_id integer not null,
  provider_label text not null,
  order_status text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, provider_status_id),
  constraint shipping_status_mappings_provider_check check (provider = 'pdc'),
  constraint shipping_status_mappings_order_status_check check (
    order_status is null or order_status in (
      'processing',
      'being_shipped',
      'out_for_delivery',
      'on_hold',
      'delivered',
      'cancelled'
    )
  )
);

insert into public.shipping_status_mappings (
  provider,
  provider_status_id,
  provider_label,
  order_status
)
values
  ('pdc', 2, 'Transfer To Branch', 'being_shipped'),
  ('pdc', 3, 'Received At Branch', 'being_shipped'),
  ('pdc', 4, 'Out For Delivery', 'out_for_delivery'),
  ('pdc', 5, 'Shipment Delivered', 'delivered'),
  ('pdc', 7, 'To Be Returned', 'on_hold'),
  ('pdc', 8, 'Returned To Shipper', 'cancelled'),
  ('pdc', 9, 'Shipment Lost', 'on_hold'),
  ('pdc', 10, 'Package Issue', 'on_hold'),
  ('pdc', 11, 'Re-Operate', 'processing'),
  ('pdc', 12, 'Picked Up', 'being_shipped'),
  ('pdc', 13, 'New Pickup', 'processing'),
  ('pdc', 14, 'Postponed', 'on_hold'),
  ('pdc', 15, 'Not Delivered', 'on_hold'),
  ('pdc', 19, 'Reschedule', 'on_hold'),
  ('pdc', 24, 'Partial Delivery', 'on_hold'),
  ('pdc', 77, 'Under Return Process', 'on_hold'),
  ('pdc', 82, 'In Transit', 'being_shipped'),
  ('pdc', 83, 'On The Way To Destination Hub', 'being_shipped'),
  ('pdc', 84, 'Received At Hub', 'being_shipped'),
  ('pdc', 85, 'Received At Destination Hub', 'being_shipped'),
  ('pdc', 87, 'In Transit - Undelivered', 'on_hold'),
  ('pdc', 88, 'In Transit To Destination Hub', 'being_shipped'),
  ('pdc', 89, 'In Transit - Undelivered', 'on_hold'),
  ('pdc', 90, 'In Transit - Undelivered', 'on_hold'),
  ('pdc', 91, 'Wrong Sort', 'on_hold'),
  ('pdc', 92, 'Unclear Address', 'on_hold'),
  ('pdc', 93, '3PL International Shipment', 'being_shipped'),
  ('pdc', 94, 'Hold At Warehouse', 'on_hold'),
  ('pdc', 95, 'On Hold', 'on_hold'),
  ('pdc', 96, 'Hold For Update', 'on_hold'),
  ('pdc', 97, 'Received At Hub', 'being_shipped'),
  ('pdc', 98, 'Received At Hub', 'being_shipped')
on conflict (provider, provider_status_id) do update
set
  provider_label = excluded.provider_label,
  order_status = excluded.order_status,
  updated_at = now();

create table if not exists public.shipping_order_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders (id) on delete cascade,
  provider text not null default 'pdc',
  state text not null default 'queued',
  to_ref text not null,
  awb text null,
  provider_status_id integer null,
  provider_status_name text null,
  provider_status_at timestamptz null,
  provider_reason_name text null,
  label_storage_path text null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_error text null,
  next_attempt_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_order_jobs_order_key unique (order_id),
  constraint shipping_order_jobs_ref_key unique (to_ref),
  constraint shipping_order_jobs_awb_key unique (awb),
  constraint shipping_order_jobs_provider_check check (provider = 'pdc'),
  constraint shipping_order_jobs_state_check check (
    state in ('queued', 'blocked', 'submitting', 'label_pending', 'ready', 'failed')
  ),
  constraint shipping_order_jobs_attempt_check check (attempt_count >= 0)
);

create index if not exists shipping_order_jobs_queue_idx
on public.shipping_order_jobs (state, next_attempt_at, created_at);

create table if not exists public.shipping_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pdc',
  event_key text not null,
  awb text not null,
  order_ref text not null,
  provider_status_id integer not null,
  provider_status_name text null,
  status_date timestamptz null,
  reason_name text null,
  payload jsonb not null,
  processed_at timestamptz null,
  processing_error text null,
  received_at timestamptz not null default now(),
  constraint shipping_webhook_events_key unique (provider, event_key),
  constraint shipping_webhook_events_provider_check check (provider = 'pdc')
);

create index if not exists shipping_webhook_events_order_idx
on public.shipping_webhook_events (order_ref, received_at desc);

create or replace function public.queue_paid_order_for_shipping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status <> 'paid' then
    return new;
  end if;

  if new.shipping_review_status not in ('not_required', 'approved') then
    return new;
  end if;

  if not exists (
    select 1
    from public.shipping_provider_settings as settings
    where settings.id = 'pdc'
      and settings.is_enabled = true
      and settings.auto_create_labels = true
  ) then
    return new;
  end if;

  insert into public.shipping_order_jobs (
    order_id,
    provider,
    state,
    to_ref,
    next_attempt_at,
    updated_at
  )
  values (
    new.id,
    'pdc',
    'queued',
    coalesce(nullif(btrim(new.order_number), ''), new.id::text),
    now(),
    now()
  )
  on conflict (order_id) do update
  set
    state = case
      when shipping_order_jobs.state in ('blocked', 'failed') then 'queued'
      else shipping_order_jobs.state
    end,
    next_attempt_at = case
      when shipping_order_jobs.state in ('blocked', 'failed') then now()
      else shipping_order_jobs.next_attempt_at
    end,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.queue_eligible_paid_orders_for_shipping()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_count integer := 0;
begin
  if not exists (
    select 1
    from public.shipping_provider_settings as settings
    where settings.id = 'pdc'
      and settings.is_enabled = true
      and settings.auto_create_labels = true
  ) then
    return 0;
  end if;

  insert into public.shipping_order_jobs (
    order_id,
    provider,
    state,
    to_ref,
    next_attempt_at,
    updated_at
  )
  select
    orders.id,
    'pdc',
    'queued',
    coalesce(nullif(btrim(orders.order_number), ''), orders.id::text),
    now(),
    now()
  from public.customer_orders as orders
  where orders.payment_status = 'paid'
    and orders.shipping_review_status in ('not_required', 'approved')
  on conflict (order_id) do update
  set
    state = case
      when shipping_order_jobs.state in ('blocked', 'failed') then 'queued'
      else shipping_order_jobs.state
    end,
    next_attempt_at = case
      when shipping_order_jobs.state in ('blocked', 'failed') then now()
      else shipping_order_jobs.next_attempt_at
    end,
    updated_at = now();

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

revoke all on function public.queue_paid_order_for_shipping()
from public, anon, authenticated;

revoke all on function public.queue_eligible_paid_orders_for_shipping()
from public, anon, authenticated;

grant execute on function public.queue_eligible_paid_orders_for_shipping()
to service_role;

drop trigger if exists customer_orders_queue_paid_shipping_insert
on public.customer_orders;

drop trigger if exists customer_orders_queue_paid_shipping_update
on public.customer_orders;

create trigger customer_orders_queue_paid_shipping_insert
after insert
on public.customer_orders
for each row
execute function public.queue_paid_order_for_shipping();

create trigger customer_orders_queue_paid_shipping_update
after update of
  payment_status,
  shipping_review_status,
  order_number,
  first_name,
  last_name,
  phone,
  street_address,
  city,
  governorate
on public.customer_orders
for each row
execute function public.queue_paid_order_for_shipping();

alter table public.shipping_provider_settings enable row level security;
alter table public.shipping_city_mappings enable row level security;
alter table public.shipping_status_mappings enable row level security;
alter table public.shipping_order_jobs enable row level security;
alter table public.shipping_webhook_events enable row level security;

revoke all on table public.shipping_provider_settings from public, anon, authenticated;
revoke all on table public.shipping_city_mappings from public, anon, authenticated;
revoke all on table public.shipping_status_mappings from public, anon, authenticated;
revoke all on table public.shipping_order_jobs from public, anon, authenticated;
revoke all on table public.shipping_webhook_events from public, anon, authenticated;

grant select, insert, update, delete on table public.shipping_provider_settings to service_role;
grant select, insert, update, delete on table public.shipping_city_mappings to service_role;
grant select, insert, update, delete on table public.shipping_status_mappings to service_role;
grant select, insert, update, delete on table public.shipping_order_jobs to service_role;
grant select, insert, update, delete on table public.shipping_webhook_events to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'shipping-labels',
  'shipping-labels',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
