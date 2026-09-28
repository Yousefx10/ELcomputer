-- Preorders reserve an allocation, never physical warehouse units. Existing
-- products and orders retain their normal defaults.
alter table public.products
  add column selling_mode text not null default 'normal',
  add column expected_availability_date date,
  add column availability_message text,
  add column preorder_active boolean not null default true,
  add column preorder_starts_at timestamptz,
  add column preorder_ends_at timestamptz,
  add column preorder_payment_mode text not null default 'full',
  add column preorder_deposit_percent numeric(5, 2),
  add column preorder_total_limit integer,
  add column preorder_customer_limit integer;

alter table public.products
  add constraint products_selling_mode_check check (selling_mode in ('normal', 'coming_soon', 'preorder')),
  add constraint products_preorder_payment_check check (
    preorder_payment_mode in ('full', 'deposit')
    and (preorder_payment_mode <> 'deposit' or preorder_deposit_percent is not null and preorder_deposit_percent > 0 and preorder_deposit_percent < 100)
  ),
  add constraint products_preorder_dates_check check (preorder_ends_at is null or preorder_starts_at is null or preorder_ends_at > preorder_starts_at),
  add constraint products_preorder_limits_check check (
    (preorder_total_limit is null or preorder_total_limit > 0)
    and (preorder_customer_limit is null or preorder_customer_limit > 0)
  ),
  add constraint products_preorder_price_check check (selling_mode <> 'preorder' or price > 0);

alter table public.customer_orders
  add column is_preorder boolean not null default false,
  add column initial_amount_due numeric(12, 2) not null default 0,
  add column amount_paid numeric(12, 2) not null default 0,
  add column preorder_fulfillment_state text not null default 'not_applicable';

alter table public.customer_orders
  add constraint customer_orders_preorder_money_check check (
    initial_amount_due >= 0 and amount_paid >= 0 and amount_paid <= total_amount
    and (not is_preorder or initial_amount_due <= total_amount)
  ),
  add constraint customer_orders_preorder_fulfillment_check check (
    preorder_fulfillment_state in ('not_applicable', 'awaiting_stock', 'ready')
    and (case when is_preorder then preorder_fulfillment_state in ('awaiting_stock', 'ready')
      else preorder_fulfillment_state = 'not_applicable' end)
  );

alter table public.customer_orders drop constraint if exists customer_orders_payment_status_check;
alter table public.customer_orders add constraint customer_orders_payment_status_check
  check (payment_status in ('pending', 'partially_paid', 'paid', 'failed', 'refunded'));

create table public.preorder_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reference text not null check (char_length(btrim(reference)) between 3 and 120),
  method text not null check (method in ('bank_transfer', 'instapay')),
  verified_by uuid not null references public.admin_users(id) on delete restrict,
  recorded_at timestamptz not null default now()
);
create index preorder_payments_order_idx on public.preorder_payments (order_id, recorded_at);
create unique index preorder_payments_reference_uidx on public.preorder_payments (order_id, lower(reference));
alter table public.preorder_payments enable row level security;
revoke all on public.preorder_payments from public, anon, authenticated;
grant select, insert on public.preorder_payments to service_role;

create function public.commerce_record_preorder_payment(
  p_order_id uuid, p_admin_id uuid, p_amount numeric, p_reference text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.customer_orders%rowtype; v_amount numeric(12,2);
begin
  if not exists (select 1 from public.admin_users as admins
    where admins.id = p_admin_id and admins.is_active
      and (admins.role = 'owner' or coalesce((admins.permissions ->> 'dashboard.orders')::boolean, false))) then
    raise exception 'Order permission is required.';
  end if;
  select * into v_order from public.customer_orders where id = p_order_id for update;
  if not found or not v_order.is_preorder then raise exception 'Preorder not found.'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'Cancelled preorders cannot receive a payment.'; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
    or p_amount > v_order.total_amount - v_order.amount_paid then
    raise exception 'Payment amount must be positive and within the outstanding balance.';
  end if;
  if char_length(btrim(coalesce(p_reference, ''))) not between 3 and 120 then
    raise exception 'A verified payment reference is required.';
  end if;
  v_amount := p_amount;
  insert into public.preorder_payments (order_id, amount, reference, method, verified_by)
  values (p_order_id, v_amount, btrim(p_reference), v_order.payment_method, p_admin_id);
  update public.customer_orders set
    amount_paid = amount_paid + v_amount,
    payment_status = case when amount_paid + v_amount = total_amount then 'paid' else 'partially_paid' end,
    paid_at = case when amount_paid + v_amount = total_amount then now() else null end,
    updated_at = now()
  where id = p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;
revoke all on function public.commerce_record_preorder_payment(uuid,uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.commerce_record_preorder_payment(uuid,uuid,numeric,text) to service_role;

alter table public.customer_order_items
  add column is_preorder boolean not null default false,
  add column preorder_payment_mode text,
  add column preorder_deposit_percent numeric(5, 2),
  add column expected_availability_date date,
  add column availability_message text,
  add column initial_amount_due numeric(12, 2);

alter table public.customer_order_items
  add constraint customer_order_items_preorder_snapshot_check check (
    not is_preorder or (
      preorder_payment_mode is not null and preorder_payment_mode in ('full', 'deposit')
      and initial_amount_due is not null and initial_amount_due >= 0 and initial_amount_due <= line_total
      and (preorder_payment_mode <> 'deposit' or preorder_deposit_percent is not null and preorder_deposit_percent > 0 and preorder_deposit_percent < 100)
    )
  );

create index customer_order_items_preorder_allocation_idx
  on public.customer_order_items (product_id, order_id) where is_preorder;

-- The legacy transaction retains every normal checkout rule. A product row
-- lock prevents a concurrent staff mode change between this guard and it.
alter function public.commerce_create_customer_order(uuid, jsonb, jsonb, boolean, uuid)
  rename to commerce_create_normal_customer_order;

create function public.commerce_create_customer_order(
  p_user_id uuid, p_order jsonb, p_items jsonb,
  p_allow_out_of_stock boolean, p_cart_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_product public.products%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A valid cart is required.';
  end if;
  for v_product in
    select products.* from public.products as products
    where products.id in (
      select (item.value ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as item(value)
    ) order by products.id for update
  loop
    if v_product.selling_mode <> 'normal' then
      raise exception 'This product is not available for normal checkout.';
    end if;
  end loop;
  return public.commerce_create_normal_customer_order(
    p_user_id, p_order, p_items, p_allow_out_of_stock, p_cart_id
  );
end;
$$;

revoke all on function public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid) from public, anon, authenticated;
revoke all on function public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid) from public, anon, authenticated;
grant execute on function public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid) to service_role;

-- The preorder path has one cart mode and no coupons. Currency arithmetic is
-- PostgreSQL numeric(12,2), with each deposit rounded to cents once.
create function public.commerce_create_preorder(
  p_user_id uuid, p_order jsonb, p_items jsonb, p_cart_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.customer_orders%rowtype;
  v_order public.customer_orders%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_requested integer;
  v_reserved integer;
  v_subtotal numeric(12,2) := 0;
  v_due numeric(12,2) := 0;
  v_line_total numeric(12,2);
  v_line_due numeric(12,2);
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'A valid signed-in customer is required.';
  end if;
  if p_cart_id is null then raise exception 'A valid cart ID is required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_cart_id::text, 0));
  select * into v_existing from public.customer_orders
  where user_id = p_user_id and checkout_cart_id = p_cart_id;
  if found then return jsonb_build_object('order', to_jsonb(v_existing), 'created', false); end if;
  if p_order is null or jsonb_typeof(p_order) <> 'object'
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'A valid order and cart are required.';
  end if;
  if nullif(btrim(p_order ->> 'first_name'), '') is null
    or nullif(btrim(p_order ->> 'phone'), '') is null
    or nullif(btrim(p_order ->> 'street_address'), '') is null
    or nullif(btrim(p_order ->> 'city'), '') is null
    or nullif(btrim(p_order ->> 'governorate'), '') is null then
    raise exception 'Complete customer and delivery details are required.';
  end if;
  if nullif(btrim(p_order ->> 'coupon_code'), '') is not null then
    raise exception 'Coupons are not available for preorders.';
  end if;
  if coalesce(p_order ->> 'payment_method', '') not in ('bank_transfer', 'instapay') then
    raise exception 'Choose bank transfer or InstaPay for a preorder.';
  end if;

  -- Lock each product in stable order; both allocation and customer limits are
  -- checked while the same row lock is held for every concurrent checkout.
  for v_product in
    select products.* from public.products as products
    where products.id in (
      select (item.value ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as item(value)
    ) order by products.id for update
  loop
    if not v_product.is_published or v_product.selling_mode <> 'preorder'
      or not v_product.preorder_active then
      raise exception 'One or more products are not open for preorder.';
    end if;
    if v_product.preorder_starts_at is not null and now() < v_product.preorder_starts_at then
      raise exception 'This preorder has not opened yet.';
    end if;
    if v_product.preorder_ends_at is not null and now() >= v_product.preorder_ends_at then
      raise exception 'This preorder has closed.';
    end if;
    select coalesce(sum((item.value ->> 'quantity')::integer), 0)::integer
      into v_requested from jsonb_array_elements(p_items) as item(value)
      where (item.value ->> 'product_id')::uuid = v_product.id;
    if v_requested < 1 or (v_product.preorder_customer_limit is not null and v_requested > v_product.preorder_customer_limit) then
      raise exception 'This preorder exceeds the customer quantity limit.';
    end if;
    select coalesce(sum(items.quantity), 0)::integer into v_reserved
    from public.customer_order_items as items
    join public.customer_orders as orders on orders.id = items.order_id
    where items.product_id = v_product.id and items.is_preorder
      and orders.status not in ('cancelled', 'refunded');
    if v_product.preorder_total_limit is not null and v_reserved + v_requested > v_product.preorder_total_limit then
      raise exception 'This preorder allocation is sold out.';
    end if;
    if v_product.preorder_customer_limit is not null then
      select coalesce(sum(items.quantity), 0)::integer into v_reserved
      from public.customer_order_items as items
      join public.customer_orders as orders on orders.id = items.order_id
      where items.product_id = v_product.id and items.is_preorder
        and orders.user_id = p_user_id and orders.status not in ('cancelled', 'refunded');
      if v_reserved + v_requested > v_product.preorder_customer_limit then
        raise exception 'This preorder exceeds your quantity limit.';
      end if;
    end if;
  end loop;

  for v_item in select item.value from jsonb_array_elements(p_items) as item(value)
    order by item.value ->> 'product_id', coalesce(item.value ->> 'variant_id', '')
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid preorder quantity.'; end if;
    select * into v_product from public.products where id = v_product_id;
    if not found or v_product.selling_mode <> 'preorder' then
      raise exception 'The product is not available for preorder.';
    end if;
    if v_product.is_serialized then
      if v_variant_id is null then raise exception 'Select a product option.'; end if;
      select * into v_variant from public.product_variants
      where id = v_variant_id and product_id = v_product_id and is_active;
      if not found then raise exception 'The selected product option is unavailable.'; end if;
    elsif v_variant_id is not null then
      raise exception 'This product has no selectable option.';
    end if;
    -- Existing catalog variants have no independent sale price. Parent price
    -- is authoritative for the chosen variant, as in normal checkout.
    v_line_total := round(v_product.price::numeric, 2) * v_quantity;
    v_line_due := case when v_product.preorder_payment_mode = 'deposit'
      then round(v_line_total * v_product.preorder_deposit_percent / 100, 2)
      else v_line_total end;
    v_subtotal := v_subtotal + v_line_total;
    v_due := v_due + v_line_due;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'variant_id', v_variant_id,
      'product_title', v_product.title, 'product_slug', v_product.slug,
      'image_url', v_product.image_url,
      'variant_name', case when v_product.is_serialized then v_variant.name else null end,
      'variant_code', case when v_product.is_serialized then v_variant.code else null end,
      'variant_sku', case when v_product.is_serialized then v_variant.sku else null end,
      'variant_color_name', case when v_product.is_serialized then v_variant.color_name else null end,
      'variant_color_hex', case when v_product.is_serialized then v_variant.color_hex else null end,
      'unit_price', round(v_product.price::numeric, 2), 'quantity', v_quantity,
      'line_total', v_line_total, 'initial_amount_due', v_line_due,
      'preorder_payment_mode', v_product.preorder_payment_mode,
      'preorder_deposit_percent', v_product.preorder_deposit_percent,
      'expected_availability_date', v_product.expected_availability_date,
      'availability_message', v_product.availability_message
    ));
  end loop;

  insert into public.customer_orders (
    user_id, checkout_cart_id, order_number, status,
    first_name, last_name, email, phone, street_address, city, governorate,
    shipping_method, payment_method, subtotal_amount, total_amount, currency,
    is_preorder, initial_amount_due, amount_paid, preorder_fulfillment_state, updated_at
  ) values (
    p_user_id, p_cart_id, coalesce(nullif(btrim(p_order ->> 'order_number'), ''),
      'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))), 'on_hold',
    btrim(p_order ->> 'first_name'), nullif(btrim(p_order ->> 'last_name'), ''),
    nullif(btrim(p_order ->> 'email'), ''), btrim(p_order ->> 'phone'),
    btrim(p_order ->> 'street_address'), btrim(p_order ->> 'city'),
    btrim(p_order ->> 'governorate'), nullif(btrim(p_order ->> 'shipping_method'), ''),
    p_order ->> 'payment_method', v_subtotal, v_subtotal, 'EGP',
    true, v_due, 0, 'awaiting_stock', now()
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.customer_order_items (
      order_id, product_id, variant_id, product_title, product_slug, image_url,
      variant_name, variant_code, variant_sku, variant_color_name, variant_color_hex,
      unit_price, quantity, line_total, is_preorder, preorder_payment_mode,
      preorder_deposit_percent, expected_availability_date, availability_message,
      initial_amount_due
    ) values (
      v_order.id, (v_item ->> 'product_id')::uuid,
      nullif(v_item ->> 'variant_id', '')::uuid,
      v_item ->> 'product_title', v_item ->> 'product_slug', v_item ->> 'image_url',
      v_item ->> 'variant_name', v_item ->> 'variant_code', v_item ->> 'variant_sku',
      v_item ->> 'variant_color_name', v_item ->> 'variant_color_hex',
      (v_item ->> 'unit_price')::numeric, (v_item ->> 'quantity')::integer,
      (v_item ->> 'line_total')::numeric, true, v_item ->> 'preorder_payment_mode',
      nullif(v_item ->> 'preorder_deposit_percent', '')::numeric,
      nullif(v_item ->> 'expected_availability_date', '')::date,
      v_item ->> 'availability_message', (v_item ->> 'initial_amount_due')::numeric
    );
  end loop;
  return jsonb_build_object('order', to_jsonb(v_order), 'created', true);
end;
$$;

revoke all on function public.commerce_create_preorder(uuid,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.commerce_create_preorder(uuid,jsonb,jsonb,uuid) to service_role;

create function public.commerce_preorder_availability(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_product public.products%rowtype; v_reserved integer;
begin
  select * into v_product from public.products
  where id = p_product_id and is_published and selling_mode = 'preorder';
  if not found then return null; end if;
  select coalesce(sum(items.quantity), 0)::integer into v_reserved
  from public.customer_order_items as items
  join public.customer_orders as orders on orders.id = items.order_id
  where items.product_id = p_product_id and items.is_preorder
    and orders.status not in ('cancelled', 'refunded');
  return jsonb_build_object(
    'available', v_product.preorder_active
      and (v_product.preorder_starts_at is null or now() >= v_product.preorder_starts_at)
      and (v_product.preorder_ends_at is null or now() < v_product.preorder_ends_at)
      and (v_product.preorder_total_limit is null or v_reserved < v_product.preorder_total_limit),
    'remaining', case when v_product.preorder_total_limit is null then null
      else greatest(v_product.preorder_total_limit - v_reserved, 0) end,
    'server_time', now()
  );
end;
$$;
revoke all on function public.commerce_preorder_availability(uuid) from public, anon, authenticated;
grant execute on function public.commerce_preorder_availability(uuid) to service_role;

-- Existing payment fee trigger adds the configured fee to total_amount. It
-- also belongs to the initial payment for preorder transactions.
create or replace function public.preorder_add_initial_payment_fee()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_preorder then
    new.initial_amount_due := new.initial_amount_due + new.payment_fee_amount;
  end if;
  return new;
end;
$$;
create trigger customer_orders_z_preorder_initial_fee
before insert on public.customer_orders
for each row
execute function public.preorder_add_initial_payment_fee();

-- A preorder cannot enter ordinary packing or shipment states until its
-- inventory is physically assigned. Cancellation never implies a refund.
create function public.preorder_guard_fulfillment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_preorder and new.preorder_fulfillment_state = 'awaiting_stock'
    and new.status not in ('on_hold', 'cancelled', 'refunded') then
    raise exception 'Preorder is awaiting stock and cannot be fulfilled.';
  end if;
  return new;
end;
$$;
create trigger customer_orders_preorder_guard
before insert or update on public.customer_orders
for each row execute function public.preorder_guard_fulfillment();

create function public.preorder_guard_packing()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.customer_orders as orders
    where orders.id = new.order_id and orders.is_preorder
      and orders.preorder_fulfillment_state <> 'ready') then
    raise exception 'Preorder is awaiting physical stock and cannot be packed.';
  end if;
  return new;
end;
$$;
create trigger order_packing_sessions_preorder_guard
before insert on public.order_packing_sessions
for each row execute function public.preorder_guard_packing();

create function public.preorder_guard_shipping_job()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.customer_orders as orders
    where orders.id = new.order_id and orders.is_preorder
      and orders.preorder_fulfillment_state <> 'ready') then
    raise exception 'Preorder is awaiting physical stock and cannot be shipped.';
  end if;
  return new;
end;
$$;
create trigger shipping_order_jobs_preorder_guard
before insert or update on public.shipping_order_jobs
for each row execute function public.preorder_guard_shipping_job();

-- Release only after full verified payment and physical stock exist. The
-- transaction assigns serialized units exactly as ordinary checkout does.
create function public.commerce_release_preorder(p_order_id uuid, p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.customer_orders%rowtype;
  v_item public.customer_order_items%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_unit public.commerce_serialized_units%rowtype;
  v_assigned integer;
  v_updated integer;
  v_warehouse_quantity integer;
begin
  if not exists (select 1 from public.admin_users as admins
    where admins.id = p_admin_id and admins.is_active
      and (admins.role = 'owner' or coalesce((admins.permissions ->> 'dashboard.orders')::boolean, false))) then
    raise exception 'Order permission is required.';
  end if;
  select * into v_order from public.customer_orders where id = p_order_id for update;
  if not found or not v_order.is_preorder then raise exception 'Preorder not found.'; end if;
  if v_order.preorder_fulfillment_state = 'ready' then return to_jsonb(v_order); end if;
  if v_order.status <> 'on_hold' then raise exception 'Only active preorders can be released.'; end if;
  if v_order.amount_paid <> v_order.total_amount or v_order.payment_status <> 'paid' then
    raise exception 'Full verified payment is required before fulfillment.';
  end if;
  perform set_config('app.serialized_inventory_write', 'on', true);
  for v_item in select * from public.customer_order_items
    where order_id = p_order_id order by product_id, variant_id, id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then raise exception 'The preorder product no longer exists.'; end if;
    if v_product.is_serialized then
      if v_item.variant_id is null or v_product.primary_warehouse_id is null then
        raise exception 'A product option and warehouse are required for release.';
      end if;
      select * into v_variant from public.product_variants where id = v_item.variant_id
        and product_id = v_product.id for update;
      if not found then raise exception 'The original product option no longer exists.'; end if;
      v_assigned := 0;
      for v_unit in select * from public.commerce_serialized_units
        where product_id = v_product.id and variant_id = v_variant.id
          and warehouse_id = v_product.primary_warehouse_id and status = 'in_stock'
        order by created_at, id limit v_item.quantity for update
      loop
        update public.commerce_serialized_units set
          status='sold', customer_order_id=p_order_id, customer_order_item_id=v_item.id,
          customer_user_id=v_order.user_id, sold_at=now(), returned_at=null, updated_at=now()
        where id=v_unit.id;
        insert into public.commerce_serialized_unit_movements (
          unit_id, product_id, variant_id, warehouse_id, customer_order_id,
          movement_type, from_status, to_status, notes
        ) values (
          v_unit.id, v_product.id, v_variant.id, v_product.primary_warehouse_id,
          p_order_id, 'sold', 'in_stock', 'sold', 'Assigned on preorder release.'
        );
        v_assigned := v_assigned + 1;
      end loop;
      if v_assigned <> v_item.quantity then raise exception 'Not enough serialized units have arrived.'; end if;
      update public.product_variants set stock_quantity=stock_quantity-v_item.quantity, updated_at=now()
        where id=v_variant.id and stock_quantity>=v_item.quantity;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then raise exception 'Serialized variant stock is inconsistent.'; end if;
    end if;
    update public.products set stock_quantity=stock_quantity-v_item.quantity
      where id=v_product.id and stock_quantity>=v_item.quantity;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'Physical product stock has not arrived.'; end if;
    if v_product.primary_warehouse_id is not null then
      update public.commerce_warehouse_inventory set
        quantity=quantity-v_item.quantity, updated_at=now()
      where warehouse_id=v_product.primary_warehouse_id and product_id=v_product.id
        and quantity>=v_item.quantity returning quantity into v_warehouse_quantity;
      if not found then raise exception 'Primary warehouse stock has not arrived.'; end if;
      insert into public.commerce_inventory_movements (
        warehouse_id, product_id, movement_type, reference_type, reference_id,
        quantity_change, quantity_after, unit_cost, notes
      ) values (
        v_product.primary_warehouse_id, v_product.id, 'sale_out', 'manual', p_order_id,
        -v_item.quantity, v_warehouse_quantity,
        coalesce(case when v_product.is_serialized then v_variant.cost_price else v_product.cost_price end,0),
        'Physical stock assigned on preorder release.'
      );
    end if;
  end loop;
  update public.customer_orders set preorder_fulfillment_state='ready', status='processing', updated_at=now()
    where id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;
revoke all on function public.commerce_release_preorder(uuid,uuid) from public, anon, authenticated;
grant execute on function public.commerce_release_preorder(uuid,uuid) to service_role;

-- No preorder is exported to ERP or automatically queued for PDC. These
-- existing triggers remain intact for all legacy orders.
create or replace function public.enqueue_daftra_order_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_enabled boolean := false;
begin
  if new.is_preorder then return new; end if;
  select coalesce(erp_mode = 'daftra' and daftra_connection_status = 'connected', false)
    into v_enabled from public.site_settings where key = 'default';
  if v_enabled is not true then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  insert into public.erp_sync_jobs (operation, local_entity_type, local_id, dedupe_key, payload)
  values ('order.export', 'customer_order', new.id,
    'daftra:order:' || new.id::text || ':status:' || new.status,
    jsonb_build_object('order_status', new.status))
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

create or replace function public.queue_paid_order_for_shipping()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_preorder and new.preorder_fulfillment_state <> 'ready') or new.payment_status <> 'paid'
    or new.shipping_review_status not in ('not_required', 'approved') then return new; end if;
  if not exists (select 1 from public.shipping_provider_settings as settings
    where settings.id = 'pdc' and settings.is_enabled and settings.auto_create_labels) then return new; end if;
  insert into public.shipping_order_jobs (order_id, provider, state, to_ref, next_attempt_at, updated_at)
  values (new.id, 'pdc', 'queued', coalesce(nullif(btrim(new.order_number), ''), new.id::text), now(), now())
  on conflict (order_id) do update set
    state = case when shipping_order_jobs.state in ('blocked', 'failed') then 'queued' else shipping_order_jobs.state end,
    next_attempt_at = case when shipping_order_jobs.state in ('blocked', 'failed') then now() else shipping_order_jobs.next_attempt_at end,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.queue_eligible_paid_orders_for_shipping()
returns integer language plpgsql security definer set search_path = public as $$
declare queued_count integer := 0;
begin
  if not exists (select 1 from public.shipping_provider_settings as settings
    where settings.id = 'pdc' and settings.is_enabled and settings.auto_create_labels) then return 0; end if;
  insert into public.shipping_order_jobs (order_id, provider, state, to_ref, next_attempt_at, updated_at)
  select orders.id, 'pdc', 'queued', coalesce(nullif(btrim(orders.order_number), ''), orders.id::text), now(), now()
  from public.customer_orders as orders
  where (not orders.is_preorder or orders.preorder_fulfillment_state = 'ready')
    and orders.payment_status = 'paid'
    and orders.shipping_review_status in ('not_required', 'approved')
  on conflict (order_id) do update set
    state = case when shipping_order_jobs.state in ('blocked', 'failed') then 'queued' else shipping_order_jobs.state end,
    next_attempt_at = case when shipping_order_jobs.state in ('blocked', 'failed') then now() else shipping_order_jobs.next_attempt_at end,
    updated_at = now();
  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

drop trigger if exists customer_orders_queue_paid_shipping_update on public.customer_orders;
create trigger customer_orders_queue_paid_shipping_update
after update of payment_status, shipping_review_status, order_number,
  first_name, last_name, phone, street_address, city, governorate,
  preorder_fulfillment_state
on public.customer_orders
for each row execute function public.queue_paid_order_for_shipping();

-- Existing role grants and RLS policies on orders and products remain in place.

-- Keep strict owner reset aware of the new private payment ledger.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_preorders;
create function public.system_reset_tables(p_scope text)
returns text[] language sql immutable set search_path = '' as $$
  with base as (select public.system_reset_tables_before_preorders(p_scope) as tables)
  select case when p_scope in ('orders', 'commerce', 'full') then
    tables[1:array_position(tables, 'customer_orders')]
    || array['preorder_payments']::text[]
    || tables[array_position(tables, 'customer_orders') + 1:cardinality(tables)]
  else tables end from base;
$$;
revoke all on function public.system_reset_tables(text) from public, anon, authenticated;
revoke all on function public.system_reset_tables_before_preorders(text) from public, anon, authenticated;
