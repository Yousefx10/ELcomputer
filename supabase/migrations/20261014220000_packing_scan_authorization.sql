begin;

-- H1: FOR SHARE requires UPDATE privilege even for a read-only validation.
-- Keep inventory grants/RLS unchanged; only this existing trigger acquires
-- scoped row locks as its owner. It never writes inventory or financial rows.
create or replace function public.validate_order_packing_scan()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_admin public.admin_users%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_serialized_unit public.commerce_serialized_units%rowtype;
  v_existing_scan_count integer;
  v_item_has_serialized_units boolean;
  v_item_is_serialized boolean;
begin
  -- Trigger-only boundary: no generic RPC or caller-selected relation/operation.
  if tg_relid <> 'public.order_packing_scans'::regclass
    or tg_op <> 'INSERT'
    or tg_when <> 'BEFORE'
    or tg_level <> 'ROW'
  then
    raise exception 'Invalid packing scan operation.' using errcode = '42501';
  end if;

  -- Recheck the authenticated server actor while holding revocation until commit.
  select admins.* into v_admin
  from public.admin_users as admins
  where admins.id = new.scanned_by
  for share;

  if not found or not coalesce(v_admin.is_active, false)
    or (v_admin.role <> 'owner' and not coalesce(
      v_admin.permissions @> '{"dashboard.view":true,"dashboard.orders":true}'::jsonb,
      false
    ))
  then
    raise exception 'This admin cannot process orders.' using errcode = '42501';
  end if;

  if new.scanned_code is null or length(btrim(new.scanned_code)) not between 1 and 500 then
    raise exception 'Scan or enter a valid item code.';
  end if;

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

  -- Session locking serializes scans, release, close and completion. The work
  -- session is read here without another lock: work-session close locks its
  -- parent first, then this same packing-session row.
  if not exists (
    select 1 from public.order_packing_work_sessions as work_sessions
    where work_sessions.id = v_session.work_session_id
      and work_sessions.admin_user_id = new.scanned_by
      and work_sessions.status = 'active'
  ) then
    raise exception 'Your packing session is closed. Start a new session.';
  end if;

  perform 1 from public.customer_orders as orders
  where orders.id = v_session.order_id
    and orders.status in ('pending_payment', 'processing')
    and orders.packing_completed_at is null
  for share;
  if not found then
    raise exception 'This order is not available for packing.';
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
      and serialized_units.customer_order_id = v_session.order_id
      and serialized_units.customer_order_item_id = v_order_item.id
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

-- Runtime trigger execution needs no direct EXECUTE grant. Remove all client
-- entry points, including service_role; the existing BEFORE INSERT trigger is
-- the only supported invocation. Ownership remains with the migration owner.
revoke all on function public.validate_order_packing_scan()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
