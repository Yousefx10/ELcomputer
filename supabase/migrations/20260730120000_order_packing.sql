begin;

-- Packing introduces a fulfillment state between processing and shipping.
alter table public.customer_orders
  drop constraint if exists customer_orders_status_check;

alter table public.customer_orders
  add constraint customer_orders_status_check check (
    status in (
      'pending_payment',
      'processing',
      'ready_to_deliver',
      'being_shipped',
      'out_for_delivery',
      'on_hold',
      'completed',
      'refunded',
      'cancelled',
      'in_progress',
      'delivered'
    )
  );

alter table public.customer_orders
  add column if not exists packing_completed_at timestamptz;

drop index if exists public.customer_orders_packing_queue_idx;
create index if not exists customer_orders_packing_queue_idx
  on public.customer_orders (status, created_at, id)
  where status in ('pending_payment', 'processing')
    and packing_completed_at is null;

-- Keep the parent SKU as an order-time snapshot. This lets a package remain
-- scannable even if its catalog product is later edited or removed.
alter table public.customer_order_items
  add column if not exists product_sku text;

update public.customer_order_items as order_items
set product_sku = products.sku
from public.products as products
where order_items.product_id = products.id
  and nullif(btrim(order_items.product_sku), '') is null
  and nullif(btrim(products.sku), '') is not null;

create or replace function public.snapshot_customer_order_item_product_sku()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_id is not null
    and nullif(btrim(new.product_sku), '') is null
  then
    select products.sku
    into new.product_sku
    from public.products as products
    where products.id = new.product_id;
  end if;

  new.product_sku := nullif(btrim(new.product_sku), '');
  return new;
end;
$$;

drop trigger if exists customer_order_items_snapshot_product_sku
  on public.customer_order_items;

create trigger customer_order_items_snapshot_product_sku
before insert or update of product_id, product_sku
on public.customer_order_items
for each row
execute function public.snapshot_customer_order_item_product_sku();

create table if not exists public.order_packing_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.customer_orders (id) on delete restrict,
  admin_user_id uuid
    references public.admin_users (id) on delete set null,
  processor_name text not null,
  processor_email text,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_order_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_packing_sessions_status_check check (
    status in ('active', 'completed', 'cancelled')
  ),
  constraint order_packing_sessions_processor_name_check check (
    length(btrim(processor_name)) between 1 and 160
  ),
  constraint order_packing_sessions_processor_email_check check (
    processor_email is null or length(btrim(processor_email)) <= 320
  ),
  constraint order_packing_sessions_completed_status_check check (
    completed_order_status is null
    or completed_order_status in (
      'ready_to_deliver',
      'being_shipped',
      'out_for_delivery',
      'on_hold'
    )
  ),
  constraint order_packing_sessions_completion_check check (
    (
      status = 'completed'
      and completed_at is not null
      and completed_order_status is not null
    )
    or (
      status <> 'completed'
      and completed_at is null
      and completed_order_status is null
    )
  )
);

create unique index if not exists order_packing_sessions_open_order_uidx
  on public.order_packing_sessions (order_id)
  where status in ('active', 'completed');

create unique index if not exists order_packing_sessions_active_admin_uidx
  on public.order_packing_sessions (admin_user_id)
  where status = 'active' and admin_user_id is not null;

create index if not exists order_packing_sessions_order_created_idx
  on public.order_packing_sessions (order_id, created_at desc);

create index if not exists order_packing_sessions_admin_created_idx
  on public.order_packing_sessions (admin_user_id, created_at desc);

create or replace function public.validate_order_packing_session_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_admin public.admin_users%rowtype;
begin
  if new.admin_user_id is null then
    raise exception 'An active order-processing admin is required.';
  end if;

  select admins.*
  into v_admin
  from public.admin_users as admins
  where admins.id = new.admin_user_id;

  if not found
    or not coalesce(v_admin.is_active, false)
    or (
      v_admin.role <> 'owner'
      and not coalesce(
        (v_admin.permissions ->> 'dashboard.orders')::boolean,
        false
      )
    )
  then
    raise exception 'This admin cannot process orders.';
  end if;

  if new.status <> 'active' then
    raise exception 'A new packing session must start as active.';
  end if;

  new.processor_name := coalesce(
    nullif(btrim(v_admin.full_name), ''),
    nullif(btrim(v_admin.email), ''),
    'Admin'
  );
  new.processor_email := nullif(lower(btrim(v_admin.email)), '');
  new.started_at := coalesce(new.started_at, now());
  new.completed_at := null;
  new.completed_order_status := null;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists order_packing_sessions_validate_insert
  on public.order_packing_sessions;

create trigger order_packing_sessions_validate_insert
before insert
on public.order_packing_sessions
for each row
execute function public.validate_order_packing_session_insert();

create table if not exists public.order_packing_scans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.order_packing_sessions (id) on delete cascade,
  order_item_id uuid not null
    references public.customer_order_items (id) on delete restrict,
  serialized_unit_id uuid
    references public.commerce_serialized_units (id) on delete restrict,
  scanned_code text not null,
  scan_type text not null default 'sku',
  scanned_by uuid
    references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint order_packing_scans_code_check check (
    length(btrim(scanned_code)) between 1 and 500
  ),
  constraint order_packing_scans_type_check check (
    scan_type in ('sku', 'serialized')
  )
);

create unique index if not exists order_packing_scans_session_unit_uidx
  on public.order_packing_scans (session_id, serialized_unit_id)
  where serialized_unit_id is not null;

create index if not exists order_packing_scans_session_created_idx
  on public.order_packing_scans (session_id, created_at, id);

create index if not exists order_packing_scans_item_idx
  on public.order_packing_scans (order_item_id, session_id);

create or replace function public.validate_order_packing_scan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_serialized_unit public.commerce_serialized_units%rowtype;
  v_existing_scan_count integer;
  v_item_has_serialized_units boolean;
  v_item_is_serialized boolean;
begin
  select sessions.*
  into v_session
  from public.order_packing_sessions as sessions
  where sessions.id = new.session_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_session.status <> 'active' then
    raise exception 'This packing session is no longer active.';
  end if;

  if new.scanned_by is null
    or v_session.admin_user_id is distinct from new.scanned_by
  then
    raise exception 'Only the admin who claimed this order can scan its items.';
  end if;

  select order_items.*
  into v_order_item
  from public.customer_order_items as order_items
  where order_items.id = new.order_item_id
    and order_items.order_id = v_session.order_id;

  if not found then
    raise exception 'The scanned item does not belong to this order.';
  end if;

  select exists (
    select 1
    from public.commerce_serialized_units as serialized_units
    where serialized_units.customer_order_item_id = v_order_item.id
      and serialized_units.customer_order_id = v_session.order_id
  )
  into v_item_has_serialized_units;

  select (
    v_order_item.variant_id is not null
    or coalesce(products.is_serialized, false)
    or v_item_has_serialized_units
  )
  into v_item_is_serialized
  from (select 1) as singleton
  left join public.products as products
    on products.id = v_order_item.product_id;

  if new.serialized_unit_id is not null then
    select serialized_units.*
    into v_serialized_unit
    from public.commerce_serialized_units as serialized_units
    where serialized_units.id = new.serialized_unit_id
    for share;

    if not found
      or v_serialized_unit.customer_order_id is distinct from v_session.order_id
      or v_serialized_unit.customer_order_item_id is distinct from v_order_item.id
    then
      raise exception 'This serialized unit is not assigned to the selected order item.';
    end if;

    if v_serialized_unit.status <> 'sold' then
      raise exception 'This serialized unit is not available for packing.';
    end if;

    if lower(btrim(new.scanned_code)) not in (
      lower(v_serialized_unit.id::text),
      lower(v_serialized_unit.qr_token::text),
      lower(btrim(v_serialized_unit.unit_code)),
      lower(btrim(coalesce(v_serialized_unit.serial_number, '')))
    ) then
      raise exception 'The scanned code does not match this serialized unit.';
    end if;

    new.scan_type := 'serialized';
  elsif v_item_is_serialized then
    raise exception 'Scan the exact assigned unit code or QR for this item.';
  else
    if lower(btrim(new.scanned_code)) not in (
      lower(btrim(coalesce(v_order_item.product_sku, ''))),
      lower(btrim(coalesce(v_order_item.variant_sku, ''))),
      lower(btrim(coalesce(v_order_item.variant_code, '')))
    ) then
      raise exception 'The scanned SKU or code does not match this order item.';
    end if;

    new.scan_type := 'sku';
  end if;

  select count(*)::integer
  into v_existing_scan_count
  from public.order_packing_scans as scans
  where scans.session_id = new.session_id
    and scans.order_item_id = new.order_item_id
    and (tg_op = 'INSERT' or scans.id <> new.id);

  if v_existing_scan_count >= v_order_item.quantity then
    raise exception 'The requested quantity for this item is already complete.';
  end if;

  new.scanned_code := btrim(new.scanned_code);
  return new;
end;
$$;

drop trigger if exists order_packing_scans_validate
  on public.order_packing_scans;

create trigger order_packing_scans_validate
before insert
on public.order_packing_scans
for each row
execute function public.validate_order_packing_scan();

create or replace function public.guard_order_packing_scan_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Packing scan history is immutable.';
  end if;

  if old.scanned_by is not null
    and new.scanned_by is null
    and (
      new.id,
      new.session_id,
      new.order_item_id,
      new.serialized_unit_id,
      new.scanned_code,
      new.scan_type,
      new.created_at
    ) is not distinct from (
      old.id,
      old.session_id,
      old.order_item_id,
      old.serialized_unit_id,
      old.scanned_code,
      old.scan_type,
      old.created_at
    )
  then
    return new;
  end if;

  raise exception 'Packing scan history is immutable.';
end;
$$;

drop trigger if exists order_packing_scans_guard_mutation
  on public.order_packing_scans;

create trigger order_packing_scans_guard_mutation
before update or delete
on public.order_packing_scans
for each row
execute function public.guard_order_packing_scan_mutation();

create or replace function public.guard_order_packing_session_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'active'
      or exists (
        select 1
        from public.order_packing_scans as scans
        where scans.session_id = old.id
      )
    then
      raise exception 'Packing session history cannot be deleted.';
    end if;

    return old;
  end if;

  if new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.processor_name is distinct from old.processor_name
    or new.processor_email is distinct from old.processor_email
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at
    or (
      new.admin_user_id is distinct from old.admin_user_id
      and new.admin_user_id is not null
    )
  then
    raise exception 'Packing session identity and processor history are immutable.';
  end if;

  if old.status = 'active'
    and old.admin_user_id is not null
    and new.admin_user_id is null
  then
    new.status := 'cancelled';
    new.completed_at := null;
    new.completed_order_status := null;
    new.updated_at := clock_timestamp();
  end if;

  if old.status in ('completed', 'cancelled')
    and (
      new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at
      or new.completed_order_status is distinct from old.completed_order_status
    )
  then
    raise exception 'A closed packing session cannot be changed.';
  end if;

  if old.status = 'active'
    and new.status not in ('active', 'completed', 'cancelled')
  then
    raise exception 'The packing session status transition is not valid.';
  end if;

  return new;
end;
$$;

drop trigger if exists order_packing_sessions_guard_mutation
  on public.order_packing_sessions;

create trigger order_packing_sessions_guard_mutation
before update or delete
on public.order_packing_sessions
for each row
execute function public.guard_order_packing_session_mutation();

create table if not exists public.customer_order_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  order_id uuid
    references public.customer_orders (id) on delete set null,
  packing_session_id uuid
    references public.order_packing_sessions (id) on delete set null,
  sender_admin_user_id uuid
    references public.admin_users (id) on delete set null,
  sender_name text not null,
  subject text not null default 'Order update',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_order_messages_sender_name_check check (
    length(btrim(sender_name)) between 1 and 160
  ),
  constraint customer_order_messages_subject_check check (
    length(btrim(subject)) between 1 and 200
  ),
  constraint customer_order_messages_body_check check (
    length(btrim(body)) between 1 and 2000
  )
);

create unique index if not exists customer_order_messages_packing_session_uidx
  on public.customer_order_messages (packing_session_id)
  where packing_session_id is not null;

create index if not exists customer_order_messages_user_created_idx
  on public.customer_order_messages (user_id, created_at desc);

create index if not exists customer_order_messages_user_unread_idx
  on public.customer_order_messages (user_id, created_at desc)
  where read_at is null;

create or replace function public.validate_customer_order_message()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order_user_id uuid;
  v_session_order_id uuid;
begin
  if new.order_id is not null then
    select orders.user_id
    into v_order_user_id
    from public.customer_orders as orders
    where orders.id = new.order_id;

    if not found or v_order_user_id is distinct from new.user_id then
      raise exception 'The message recipient does not own the selected order.';
    end if;
  end if;

  if new.packing_session_id is not null then
    select sessions.order_id
    into v_session_order_id
    from public.order_packing_sessions as sessions
    where sessions.id = new.packing_session_id;

    if not found
      or new.order_id is null
      or v_session_order_id is distinct from new.order_id
    then
      raise exception 'The message packing session does not match its order.';
    end if;
  end if;

  new.sender_name := btrim(new.sender_name);
  new.subject := btrim(new.subject);
  new.body := btrim(new.body);
  return new;
end;
$$;

drop trigger if exists customer_order_messages_validate
  on public.customer_order_messages;

create trigger customer_order_messages_validate
before insert or update
on public.customer_order_messages
for each row
execute function public.validate_customer_order_message();

alter table public.order_packing_sessions enable row level security;
alter table public.order_packing_scans enable row level security;
alter table public.customer_order_messages enable row level security;

revoke all on table public.order_packing_sessions from public, anon, authenticated;
revoke all on table public.order_packing_scans from public, anon, authenticated;
revoke all on table public.customer_order_messages from public, anon, authenticated;

grant select, insert, update, delete
  on table public.order_packing_sessions to service_role;
grant select, insert, update, delete
  on table public.order_packing_scans to service_role;
grant select, insert, update, delete
  on table public.customer_order_messages to service_role;
grant select on table public.customer_order_messages to authenticated;

drop policy if exists "Customers can read their own order messages"
  on public.customer_order_messages;

create policy "Customers can read their own order messages"
on public.customer_order_messages
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.complete_order_packing_session(
  p_session_id uuid,
  p_admin_user_id uuid,
  p_next_order_status text default 'ready_to_deliver',
  p_message_subject text default null,
  p_message_body text default null,
  p_sender_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_order public.customer_orders%rowtype;
  v_now timestamptz := clock_timestamp();
  v_message_id uuid;
  v_required_quantity integer;
  v_scanned_quantity integer;
  v_subject text;
  v_body text := nullif(btrim(p_message_body), '');
  v_sender_name text := coalesce(nullif(btrim(p_sender_name), ''), 'Store team');
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_session_id is null or p_admin_user_id is null then
    raise exception 'A packing session and processor are required.';
  end if;

  if p_next_order_status is null
    or p_next_order_status not in (
    'ready_to_deliver',
    'being_shipped',
    'out_for_delivery',
    'on_hold'
    )
  then
    raise exception 'The selected completed order status is not valid.';
  end if;

  if v_body is not null and length(v_body) > 2000 then
    raise exception 'The purchaser message cannot exceed 2000 characters.';
  end if;

  select sessions.*
  into v_session
  from public.order_packing_sessions as sessions
  where sessions.id = p_session_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_session.admin_user_id is distinct from p_admin_user_id then
    raise exception 'Only the admin who claimed this order can complete it.';
  end if;

  if not exists (
    select 1
    from public.admin_users as admins
    where admins.id = p_admin_user_id
      and admins.is_active
      and (
        admins.role = 'owner'
        or coalesce(
          (admins.permissions ->> 'dashboard.orders')::boolean,
          false
        )
      )
  ) then
    raise exception 'This admin can no longer process orders.';
  end if;

  select orders.*
  into v_order
  from public.customer_orders as orders
  where orders.id = v_session.order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_session.status = 'completed' then
    select messages.id
    into v_message_id
    from public.customer_order_messages as messages
    where messages.packing_session_id = v_session.id
    limit 1;

    return jsonb_build_object(
      'session_id', v_session.id,
      'order_id', v_session.order_id,
      'order_status', v_order.status,
      'message_id', v_message_id,
      'already_completed', true
    );
  end if;

  if v_session.status <> 'active' then
    raise exception 'This packing session is no longer active.';
  end if;

  if v_order.status not in ('pending_payment', 'processing') then
    raise exception 'The order status changed while it was being packed.';
  end if;

  -- Stabilize every assigned physical unit while its final scan state is
  -- validated so an inventory return cannot race this completion transaction.
  perform assigned_units.id
  from public.commerce_serialized_units as assigned_units
  where assigned_units.customer_order_id = v_order.id
  order by assigned_units.id
  for update;

  if not exists (
    select 1
    from public.customer_order_items as order_items
    where order_items.order_id = v_order.id
  ) then
    raise exception 'This order has no items to confirm.';
  end if;

  if exists (
    select 1
    from public.customer_order_items as order_items
    left join lateral (
      select count(*)::integer as scan_count
      from public.order_packing_scans as scans
      where scans.session_id = v_session.id
        and scans.order_item_id = order_items.id
    ) as scan_totals on true
    where order_items.order_id = v_order.id
      and coalesce(scan_totals.scan_count, 0) <> order_items.quantity
  ) then
    raise exception 'Every requested item must be scanned before completing this order.';
  end if;

  select count(*)::integer
  into v_scanned_quantity
  from public.order_packing_scans as scans
  where scans.session_id = v_session.id;

  select coalesce(sum(order_items.quantity), 0)::integer
  into v_required_quantity
  from public.customer_order_items as order_items
  where order_items.order_id = v_order.id;

  if v_scanned_quantity <> v_required_quantity then
    raise exception 'The scanned quantity does not match the requested order quantity.';
  end if;

  if exists (
    select 1
    from public.customer_order_items as order_items
    left join public.products as products
      on products.id = order_items.product_id
    where order_items.order_id = v_order.id
      and (
        order_items.variant_id is not null
        or coalesce(products.is_serialized, false)
        or exists (
          select 1
          from public.commerce_serialized_units as assigned_units
          where assigned_units.customer_order_item_id = order_items.id
            and assigned_units.customer_order_id = v_order.id
        )
      )
      and (
        (
          select count(*)
          from public.commerce_serialized_units as assigned_units
          where assigned_units.customer_order_item_id = order_items.id
            and assigned_units.customer_order_id = v_order.id
            and assigned_units.status = 'sold'
        ) <> order_items.quantity
        or (
          select count(*)
          from public.order_packing_scans as scans
          join public.commerce_serialized_units as assigned_units
            on assigned_units.id = scans.serialized_unit_id
          where scans.session_id = v_session.id
            and scans.order_item_id = order_items.id
            and assigned_units.customer_order_item_id = order_items.id
            and assigned_units.customer_order_id = v_order.id
            and assigned_units.status = 'sold'
        ) <> order_items.quantity
      )
  ) then
    raise exception 'Every serialized item must still be assigned, sold, and scanned for this order.';
  end if;

  if v_body is not null and v_order.user_id is null then
    raise exception 'This guest order does not have a customer account inbox.';
  end if;

  update public.customer_orders
  set
    status = p_next_order_status,
    packing_completed_at = v_now,
    updated_at = v_now
  where id = v_order.id;

  update public.order_packing_sessions
  set
    status = 'completed',
    completed_at = v_now,
    completed_order_status = p_next_order_status,
    updated_at = v_now
  where id = v_session.id;

  if v_body is not null then
    v_subject := coalesce(
      nullif(btrim(p_message_subject), ''),
      'Order ' || coalesce(v_order.order_number, '#' || left(v_order.id::text, 8)) || ' update'
    );

    if length(v_subject) > 200 then
      raise exception 'The purchaser message subject cannot exceed 200 characters.';
    end if;

    insert into public.customer_order_messages (
      user_id,
      order_id,
      packing_session_id,
      sender_admin_user_id,
      sender_name,
      subject,
      body
    )
    values (
      v_order.user_id,
      v_order.id,
      v_session.id,
      p_admin_user_id,
      v_sender_name,
      v_subject,
      v_body
    )
    returning id into v_message_id;
  end if;

  return jsonb_build_object(
    'session_id', v_session.id,
    'order_id', v_order.id,
    'order_status', p_next_order_status,
    'message_id', v_message_id,
    'required_quantity', v_required_quantity,
    'scanned_quantity', v_scanned_quantity,
    'already_completed', false
  );
end;
$$;

revoke all on function public.complete_order_packing_session(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.complete_order_packing_session(
  uuid,
  uuid,
  text,
  text,
  text,
  text
) to service_role;

commit;
