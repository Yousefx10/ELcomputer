-- Purchase-time terms only. No historical entitlement or start policy is inferred.
begin;

alter table public.products
  add column warranty_status text not null default 'unknown',
  add column warranty_duration_value integer,
  add column warranty_duration_unit text,
  add constraint products_warranty_terms_check check (
    (warranty_status in ('unknown', 'none') and warranty_duration_value is null and warranty_duration_unit is null)
    or (warranty_status = 'included' and warranty_duration_value is not null
      and warranty_duration_unit is not null and warranty_duration_value >= 1
      and ((warranty_duration_unit = 'months' and warranty_duration_value <= 120)
        or (warranty_duration_unit = 'years' and warranty_duration_value <= 10)))
  );

alter table public.customer_order_items
  add column warranty_status text,
  add column warranty_duration_value integer,
  add column warranty_duration_unit text,
  add column warranty_start_basis text,
  add column warranty_snapshot_at timestamptz,
  add constraint customer_order_items_warranty_terms_check check (
    -- All pre-feature rows remain NULL. Imports outside checkout stay unknown.
    (warranty_snapshot_at is null and warranty_status is null
      and warranty_duration_value is null and warranty_duration_unit is null and warranty_start_basis is null)
    or (warranty_snapshot_at is not null and warranty_status is not null and (
      (warranty_status in ('unknown', 'none') and warranty_duration_value is null
        and warranty_duration_unit is null and warranty_start_basis is null)
      or (warranty_status = 'included' and warranty_duration_value is not null
        and warranty_duration_unit is not null and warranty_start_basis is not null
        and warranty_start_basis = 'unresolved' and warranty_duration_value >= 1
        and ((warranty_duration_unit = 'months' and warranty_duration_value <= 120)
          or (warranty_duration_unit = 'years' and warranty_duration_value <= 10)))
    ))
  );

comment on column public.products.warranty_status is 'unknown = unconfigured; none = explicit no warranty; included = structured duration. Free-text specifications do not define entitlement.';
comment on column public.customer_order_items.warranty_snapshot_at is 'Capture time, NOT warranty start. NULL = no trusted purchase snapshot. Never backfill from current catalog.';
comment on column public.customer_order_items.warranty_start_basis is 'unresolved: business start policy is not authoritative. No expiry or eligibility enforcement until a separately reviewed policy extends this model.';

create function public.commerce_snapshot_item_warranty() returns trigger
language plpgsql security definer set search_path = '' as $$
declare terms public.products%rowtype;
begin
  -- Discard supplied terms even for a trusted insert. Only the authoritative
  -- checkout wrappers open a transaction-local capture scope. Appending an
  -- item to an old order/importing history must not copy today's product terms.
  new.warranty_status := null;
  new.warranty_duration_value := null;
  new.warranty_duration_unit := null;
  new.warranty_start_basis := null;
  new.warranty_snapshot_at := null;
  if coalesce(current_setting('app.warranty_purchase_capture', true), '') <> 'on' then
    return new;
  end if;

  -- Both canonical transactions already lock products in deterministic order.
  -- Reuse those locks; FOR SHARE also protects any future scoped insertion.
  select * into terms from public.products where id = new.product_id for share;
  if not found then raise exception 'A catalog product is required for a warranty snapshot.'; end if;
  new.warranty_status := terms.warranty_status;
  new.warranty_duration_value := terms.warranty_duration_value;
  new.warranty_duration_unit := terms.warranty_duration_unit;
  new.warranty_start_basis := case when terms.warranty_status = 'included' then 'unresolved' else null end;
  new.warranty_snapshot_at := pg_catalog.statement_timestamp();
  return new;
end $$;

create trigger customer_order_items_snapshot_warranty
before insert on public.customer_order_items for each row
execute function public.commerce_snapshot_item_warranty();

create function public.commerce_guard_item_warranty() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.warranty_status, new.warranty_duration_value, new.warranty_duration_unit,
      new.warranty_start_basis, new.warranty_snapshot_at)
    is distinct from row(old.warranty_status, old.warranty_duration_value, old.warranty_duration_unit,
      old.warranty_start_basis, old.warranty_snapshot_at) then
    raise exception 'Purchased warranty terms are immutable.';
  end if;
  -- Prevent rebinding an entitlement to another purchase/product/variant.
  -- Existing ON DELETE SET NULL catalog FKs must still detach deleted records;
  -- the purchased terms and identity text remain on the order item.
  if new.id is distinct from old.id or new.order_id is distinct from old.order_id
    or (new.product_id is distinct from old.product_id and new.product_id is not null)
    or (new.variant_id is distinct from old.variant_id and new.variant_id is not null) then
    raise exception 'Purchased warranty identity cannot be reassigned.';
  end if;
  return new;
end $$;

create trigger customer_order_items_guard_warranty
before update on public.customer_order_items for each row
execute function public.commerce_guard_item_warranty();

-- Keep the entire existing checkout/ERP/SMS implementations byte-for-byte.
-- A failed transaction rolls back capture and snapshots with the order/stock.
alter function public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid)
  rename to commerce_create_customer_order_before_warranty;
create function public.commerce_create_customer_order(
  p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; previous text := coalesce(current_setting('app.warranty_purchase_capture', true), '');
begin
  perform set_config('app.warranty_purchase_capture', 'on', true);
  result := public.commerce_create_customer_order_before_warranty(p_user_id, p_order, p_items, p_allow_out_of_stock, p_cart_id);
  perform set_config('app.warranty_purchase_capture', previous, true);
  return result;
end $$;

alter function public.commerce_create_preorder(uuid,jsonb,jsonb,uuid)
  rename to commerce_create_preorder_before_warranty;
create function public.commerce_create_preorder(
  p_user_id uuid, p_order jsonb, p_items jsonb, p_cart_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; previous text := coalesce(current_setting('app.warranty_purchase_capture', true), '');
begin
  perform set_config('app.warranty_purchase_capture', 'on', true);
  result := public.commerce_create_preorder_before_warranty(p_user_id, p_order, p_items, p_cart_id);
  perform set_config('app.warranty_purchase_capture', previous, true);
  return result;
end $$;

-- Reuse table RLS: products.add/edit staff writes; order-owner SELECT only.
-- No customer write policy/grant or parallel warranty table/RPC is introduced.
revoke all on function public.commerce_snapshot_item_warranty(), public.commerce_guard_item_warranty(),
  public.commerce_create_customer_order_before_warranty(uuid,jsonb,jsonb,boolean,uuid),
  public.commerce_create_preorder_before_warranty(uuid,jsonb,jsonb,uuid),
  public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid),
  public.commerce_create_preorder(uuid,jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.commerce_create_customer_order_before_warranty(uuid,jsonb,jsonb,boolean,uuid),
  public.commerce_create_preorder_before_warranty(uuid,jsonb,jsonb,uuid) from service_role;
grant execute on function public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid),
  public.commerce_create_preorder(uuid,jsonb,jsonb,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
