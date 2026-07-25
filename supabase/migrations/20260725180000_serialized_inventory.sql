begin;

-- Also permits this migration to upgrade an earlier draft safely while its
-- projection guards are already installed. The setting is transaction-local.
select set_config('app.serialized_inventory_write', 'on', true);

-- Every newly-created catalog product is individually tracked. Existing stock is
-- deliberately left in its legacy mode when its physical units, variants, and
-- locations cannot be inferred safely. Existing zero-stock products can be
-- converted without inventing inventory history.
alter table public.products
  add column if not exists is_serialized boolean;

update public.products
set is_serialized = false
where is_serialized is null;

update public.products as products
set is_serialized = true
where products.is_serialized = false
  and coalesce(products.stock_quantity, 0) = 0
  and not exists (
    select 1
    from public.commerce_warehouse_inventory as inventory
    where inventory.product_id = products.id
      and inventory.quantity <> 0
  );

alter table public.products
  alter column is_serialized set default true,
  alter column is_serialized set not null;

create sequence if not exists public.commerce_serialized_unit_code_seq
  as bigint
  minvalue 1
  start with 1
  increment by 1
  cache 50;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products (id) on delete cascade,
  name text not null,
  code text not null,
  sku text,
  color_name text,
  color_hex text,
  price numeric(12, 2) not null default 0,
  cost_price numeric(12, 2) not null default 0,
  stock_quantity integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_name_not_blank_check
    check (length(btrim(name)) > 0),
  constraint product_variants_code_not_blank_check
    check (length(btrim(code)) > 0),
  constraint product_variants_price_check check (price >= 0),
  constraint product_variants_cost_price_check check (cost_price >= 0),
  constraint product_variants_stock_quantity_check check (stock_quantity >= 0),
  constraint product_variants_color_hex_check check (
    color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'
  )
);

drop index if exists public.product_variants_product_code_uidx;
create unique index product_variants_product_code_uidx
  on public.product_variants (product_id, lower(code))
  where is_active;

drop index if exists public.product_variants_sku_uidx;
create unique index product_variants_sku_uidx
  on public.product_variants (lower(sku))
  where is_active and sku is not null and btrim(sku) <> '';

create index if not exists product_variants_product_active_idx
  on public.product_variants (product_id, is_active, created_at);

-- A zero-stock legacy product has no physical identity to infer, but it still
-- needs one catalog reference before Procurement can receive it. Backfill only
-- that reference: no SKU, quantity, unit, QR token, warehouse balance, or
-- movement is created. Existing product color metadata is retained when valid.
insert into public.product_variants (
  product_id,
  name,
  code,
  color_name,
  color_hex
)
select
  products.id,
  coalesce(nullif(btrim(products.color_name), ''), 'Default'),
  coalesce(
    nullif(
      regexp_replace(
        upper(coalesce(products.color_name, '')),
        '[^A-Z0-9_-]',
        '',
        'g'
      ),
      ''
    ),
    'DEFAULT'
  ),
  nullif(btrim(products.color_name), ''),
  case
    when products.color_hex ~ '^#[0-9A-Fa-f]{6}$'
      then products.color_hex
    else null
  end
from public.products as products
where products.is_serialized
  and coalesce(products.stock_quantity, 0) = 0
  and not exists (
    select 1
    from public.commerce_warehouse_inventory as inventory
    where inventory.product_id = products.id
      and inventory.quantity <> 0
  )
  and not exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = products.id
  );

-- Procurement is both the purchase document and the immediate receiving event
-- in the current commerce workflow. The receipt key makes client retries
-- idempotent, while the payload hash prevents a reused supplier reference from
-- silently changing an already-received order.
alter table public.commerce_procurement_orders
  add column if not exists receipt_key text,
  add column if not exists receipt_payload_hash text;

create unique index if not exists commerce_procurement_orders_receipt_key_uidx
  on public.commerce_procurement_orders (receipt_key)
  where receipt_key is not null;

alter table public.commerce_procurement_items
  add column if not exists variant_id uuid,
  add column if not exists received_quantity integer not null default 0;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commerce_procurement_items_variant_id_fkey'
      and conrelid = 'public.commerce_procurement_items'::regclass
  ) then
    alter table public.commerce_procurement_items
      add constraint commerce_procurement_items_variant_id_fkey
      foreign key (variant_id)
      references public.product_variants (id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'commerce_procurement_items_received_quantity_check'
      and conrelid = 'public.commerce_procurement_items'::regclass
  ) then
    alter table public.commerce_procurement_items
      add constraint commerce_procurement_items_received_quantity_check
      check (
        received_quantity >= 0
        and received_quantity <= quantity
      );
  end if;
end;
$migration$;

create index if not exists commerce_procurement_items_variant_idx
  on public.commerce_procurement_items (variant_id, created_at)
  where variant_id is not null;

alter table public.customer_orders
  add column if not exists checkout_cart_id uuid;

alter table public.customer_orders
  drop constraint if exists customer_orders_user_id_fkey;

alter table public.customer_orders
  alter column user_id drop not null;

alter table public.customer_orders
  add constraint customer_orders_user_id_fkey
  foreign key (user_id)
  references auth.users (id)
  on delete set null;

create unique index if not exists customer_orders_user_checkout_cart_uidx
  on public.customer_orders (user_id, checkout_cart_id)
  where checkout_cart_id is not null;

alter table public.customer_order_items
  add column if not exists variant_id uuid,
  add column if not exists variant_name text,
  add column if not exists variant_code text,
  add column if not exists variant_sku text,
  add column if not exists variant_color_name text,
  add column if not exists variant_color_hex text;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_order_items_variant_id_fkey'
      and conrelid = 'public.customer_order_items'::regclass
  ) then
    alter table public.customer_order_items
      add constraint customer_order_items_variant_id_fkey
      foreign key (variant_id)
      references public.product_variants (id)
      on delete set null;
  end if;
end;
$migration$;

create index if not exists customer_order_items_variant_id_idx
  on public.customer_order_items (variant_id);

create table if not exists public.commerce_serialized_inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products (id) on delete restrict,
  warehouse_id uuid not null
    references public.commerce_warehouses (id) on delete restrict,
  procurement_order_id uuid
    references public.commerce_procurement_orders (id) on delete restrict,
  procurement_item_id uuid
    references public.commerce_procurement_items (id) on delete restrict,
  created_count integer not null default 0,
  variant_count integer not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint commerce_serialized_batches_created_count_check
    check (created_count >= 0),
  constraint commerce_serialized_batches_variant_count_check
    check (variant_count >= 0)
);

create index if not exists commerce_serialized_batches_product_created_idx
  on public.commerce_serialized_inventory_batches (product_id, created_at desc);

alter table public.commerce_serialized_inventory_batches
  add column if not exists procurement_order_id uuid
    references public.commerce_procurement_orders (id) on delete restrict,
  add column if not exists procurement_item_id uuid
    references public.commerce_procurement_items (id) on delete restrict;

create unique index if not exists commerce_serialized_batches_procurement_item_uidx
  on public.commerce_serialized_inventory_batches (procurement_item_id)
  where procurement_item_id is not null;

create table if not exists public.commerce_serialized_units (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid
    references public.commerce_serialized_inventory_batches (id)
    on delete restrict,
  unit_code text not null,
  serial_number text,
  qr_token uuid not null default gen_random_uuid(),
  product_id uuid not null
    references public.products (id) on delete restrict,
  variant_id uuid not null
    references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null
    references public.commerce_warehouses (id) on delete restrict,
  status text not null default 'in_stock',
  unit_cost numeric(12, 2) not null default 0,
  procurement_order_id uuid
    references public.commerce_procurement_orders (id) on delete restrict,
  procurement_item_id uuid
    references public.commerce_procurement_items (id) on delete restrict,
  customer_order_id uuid
    references public.customer_orders (id) on delete restrict,
  customer_order_item_id uuid
    references public.customer_order_items (id) on delete restrict,
  customer_user_id uuid
    references auth.users (id) on delete set null,
  sold_at timestamptz,
  returned_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_serialized_units_status_check check (
    status in ('in_stock', 'sold', 'damaged', 'lost')
  ),
  constraint commerce_serialized_units_unit_code_not_blank_check
    check (length(btrim(unit_code)) > 0),
  constraint commerce_serialized_units_unit_cost_check check (unit_cost >= 0),
  constraint commerce_serialized_units_sold_link_check check (
    status <> 'sold'
    or (
      customer_order_id is not null
      and customer_order_item_id is not null
      and sold_at is not null
    )
  )
);

create unique index if not exists commerce_serialized_units_code_uidx
  on public.commerce_serialized_units (upper(unit_code));

create unique index if not exists commerce_serialized_units_serial_uidx
  on public.commerce_serialized_units (lower(serial_number))
  where serial_number is not null and btrim(serial_number) <> '';

create unique index if not exists commerce_serialized_units_qr_token_uidx
  on public.commerce_serialized_units (qr_token);

create index if not exists commerce_serialized_units_stock_lookup_idx
  on public.commerce_serialized_units (
    product_id,
    variant_id,
    warehouse_id,
    status,
    created_at,
    id
  );

create index if not exists commerce_serialized_units_order_item_idx
  on public.commerce_serialized_units (customer_order_item_id)
  where customer_order_item_id is not null;

alter table public.commerce_serialized_units
  add column if not exists procurement_order_id uuid
    references public.commerce_procurement_orders (id) on delete restrict,
  add column if not exists procurement_item_id uuid
    references public.commerce_procurement_items (id) on delete restrict;

create index if not exists commerce_serialized_units_procurement_item_idx
  on public.commerce_serialized_units (procurement_item_id, created_at)
  where procurement_item_id is not null;

create table if not exists public.commerce_serialized_unit_movements (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null
    references public.commerce_serialized_units (id) on delete restrict,
  product_id uuid not null
    references public.products (id) on delete restrict,
  variant_id uuid not null
    references public.product_variants (id) on delete restrict,
  warehouse_id uuid not null
    references public.commerce_warehouses (id) on delete restrict,
  procurement_order_id uuid
    references public.commerce_procurement_orders (id) on delete restrict,
  procurement_item_id uuid
    references public.commerce_procurement_items (id) on delete restrict,
  customer_order_id uuid
    references public.customer_orders (id) on delete restrict,
  order_return_id uuid
    references public.commerce_order_returns (id) on delete restrict,
  actor_admin_id uuid,
  movement_type text not null,
  from_status text,
  to_status text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint commerce_serialized_movements_type_check check (
    movement_type in (
      'received',
      'sold',
      'returned',
      'damaged',
      'lost',
      'adjusted'
    )
  ),
  constraint commerce_serialized_movements_from_status_check check (
    from_status is null
    or from_status in ('in_stock', 'sold', 'damaged', 'lost')
  ),
  constraint commerce_serialized_movements_to_status_check check (
    to_status in ('in_stock', 'sold', 'damaged', 'lost')
  )
);

create index if not exists commerce_serialized_movements_unit_created_idx
  on public.commerce_serialized_unit_movements (unit_id, created_at desc);

create index if not exists commerce_serialized_movements_order_idx
  on public.commerce_serialized_unit_movements (customer_order_id, created_at desc)
  where customer_order_id is not null;

alter table public.commerce_serialized_unit_movements
  add column if not exists procurement_order_id uuid
    references public.commerce_procurement_orders (id) on delete restrict,
  add column if not exists procurement_item_id uuid
    references public.commerce_procurement_items (id) on delete restrict;

create index if not exists commerce_serialized_movements_procurement_item_idx
  on public.commerce_serialized_unit_movements (
    procurement_item_id,
    created_at desc
  )
  where procurement_item_id is not null;

alter table public.commerce_order_return_items
  add column if not exists variant_id uuid,
  add column if not exists serialized_unit_id uuid;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commerce_order_return_items_variant_id_fkey'
      and conrelid = 'public.commerce_order_return_items'::regclass
  ) then
    alter table public.commerce_order_return_items
      add constraint commerce_order_return_items_variant_id_fkey
      foreign key (variant_id)
      references public.product_variants (id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'commerce_order_return_items_serialized_unit_id_fkey'
      and conrelid = 'public.commerce_order_return_items'::regclass
  ) then
    alter table public.commerce_order_return_items
      add constraint commerce_order_return_items_serialized_unit_id_fkey
      foreign key (serialized_unit_id)
      references public.commerce_serialized_units (id)
      on delete restrict;
  end if;
end;
$migration$;

create index if not exists commerce_order_return_items_serialized_unit_idx
  on public.commerce_order_return_items (serialized_unit_id)
  where serialized_unit_id is not null;

create or replace function public.commerce_reject_serialized_stock_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_product_id uuid;
  v_is_serialized boolean;
  v_old_is_serialized boolean;
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_table_name = 'products' then
    if tg_op = 'INSERT' and not new.is_serialized then
      raise exception
        'Every new product must use individual item IDs and QR tracking.';
    end if;

    if tg_op = 'INSERT' and new.stock_quantity <> 0 then
      raise exception
        'A product must start at zero stock; receive every physical item through Procurement.';
    end if;

    if tg_op = 'INSERT'
      and (
        new.primary_warehouse_id is null
        or not exists (
          select 1
          from public.commerce_warehouses as warehouses
          where warehouses.id = new.primary_warehouse_id
            and warehouses.is_active
        )
      )
    then
      raise exception
        'Every new tracked product requires an active primary warehouse reference.';
    end if;

    if tg_op = 'UPDATE'
      and new.is_serialized is distinct from old.is_serialized
    then
      raise exception
        'Inventory tracking mode cannot be changed after a product is created.';
    end if;

    if tg_op = 'UPDATE'
      and old.is_serialized
      and new.primary_warehouse_id is distinct from old.primary_warehouse_id
      and new.primary_warehouse_id is not null
      and not exists (
        select 1
        from public.commerce_warehouses as warehouses
        where warehouses.id = new.primary_warehouse_id
          and warehouses.is_active
      )
    then
      raise exception
        'A tracked product requires an active primary warehouse reference.';
    end if;

    if tg_op = 'UPDATE'
      and old.is_serialized
      and new.primary_warehouse_id is distinct from old.primary_warehouse_id
      and (
        coalesce(old.stock_quantity, 0) <> 0
        or exists (
          select 1
          from public.commerce_serialized_units as units
          where units.product_id = old.id
        )
      )
    then
      raise exception
        'A tracked product warehouse can only change before its first physical item exists.';
    end if;

    if tg_op = 'UPDATE'
      and old.is_serialized
      and new.stock_quantity is distinct from old.stock_quantity
    then
      raise exception
        'Product stock is a projection of individually tracked units; use Procurement.';
    end if;

    return new;
  end if;

  if tg_table_name = 'product_variants' then
    v_product_id := new.product_id;

    select products.is_serialized
    into v_is_serialized
    from public.products as products
    where products.id = v_product_id;

    if v_is_serialized
      and (
        (tg_op = 'INSERT' and new.stock_quantity <> 0)
        or (
          tg_op = 'UPDATE'
          and new.stock_quantity is distinct from old.stock_quantity
        )
      )
    then
      raise exception
        'Variant stock is a projection of individually tracked units; use Procurement.';
    end if;

    return new;
  end if;

  v_product_id := case
    when tg_op = 'DELETE' then old.product_id
    else new.product_id
  end;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = v_product_id;

  if tg_op = 'DELETE' then
    if v_is_serialized then
      raise exception
        'A tracked warehouse balance cannot be deleted; move exact units through inventory workflows.';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    select products.is_serialized
    into v_old_is_serialized
    from public.products as products
    where products.id = old.product_id;
  end if;

  if (
      v_is_serialized
      or coalesce(v_old_is_serialized, false)
    )
    and (
      (tg_op = 'INSERT' and new.quantity <> 0)
      or (
        tg_op = 'UPDATE'
        and (
          new.product_id is distinct from old.product_id
          or new.warehouse_id is distinct from old.warehouse_id
          or new.quantity is distinct from old.quantity
          or new.average_cost is distinct from old.average_cost
        )
      )
    )
  then
    raise exception
      'Warehouse stock is a projection of individually tracked units; use Procurement.';
  end if;

  return new;
end;
$function$;

create or replace function public.commerce_create_customer_order(
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

    if not found or not v_product.is_published then
      raise exception 'One or more products are no longer available.';
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
        and v_product.stock_quantity < v_quantity
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

  perform set_config('app.serialized_inventory_write', 'on', true);

  for v_item in
    select item_rows.value
    from jsonb_array_elements(v_normalized_items) as item_rows(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_line_total := (v_item ->> 'line_total')::numeric;

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

      update public.product_variants
      set
        stock_quantity = stock_quantity - v_quantity,
        updated_at = now()
      where id = v_variant_id
        and stock_quantity >= v_quantity;

      get diagnostics v_updated_rows = row_count;
      if v_updated_rows <> 1 then
        raise exception 'Serialized variant stock is inconsistent.';
      end if;

      update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product_id
        and stock_quantity >= v_quantity;

      get diagnostics v_updated_rows = row_count;
      if v_updated_rows <> 1 then
        raise exception 'Serialized product stock is inconsistent.';
      end if;

      update public.commerce_warehouse_inventory
      set
        quantity = quantity - v_quantity,
        updated_at = now()
      where warehouse_id = (v_item ->> 'primary_warehouse_id')::uuid
        and product_id = v_product_id
        and quantity >= v_quantity
      returning quantity into v_warehouse_quantity;

      if not found then
        raise exception 'Serialized warehouse stock is inconsistent.';
      end if;

      v_total_assigned_units := v_total_assigned_units + v_assigned_units;
    else
      if coalesce(p_allow_out_of_stock, false) then
        update public.products
        set stock_quantity = greatest(stock_quantity - v_quantity, 0)
        where id = v_product_id;
      else
        update public.products
        set stock_quantity = stock_quantity - v_quantity
        where id = v_product_id
          and stock_quantity >= v_quantity;

        get diagnostics v_updated_rows = row_count;
        if v_updated_rows <> 1 then
          raise exception 'One or more products no longer have enough stock.';
        end if;
      end if;

      v_has_warehouse_inventory := false;
      v_warehouse_quantity := null;

      if nullif(v_item ->> 'primary_warehouse_id', '') is not null then
        select true
        into v_has_warehouse_inventory
        from public.commerce_warehouse_inventory as inventory
        where inventory.warehouse_id =
            (v_item ->> 'primary_warehouse_id')::uuid
          and inventory.product_id = v_product_id
        for update;

        if v_has_warehouse_inventory then
          if coalesce(p_allow_out_of_stock, false) then
            update public.commerce_warehouse_inventory
            set
              quantity = greatest(quantity - v_quantity, 0),
              updated_at = now()
            where warehouse_id =
                (v_item ->> 'primary_warehouse_id')::uuid
              and product_id = v_product_id
            returning quantity into v_warehouse_quantity;
          else
            update public.commerce_warehouse_inventory
            set
              quantity = quantity - v_quantity,
              updated_at = now()
            where warehouse_id =
                (v_item ->> 'primary_warehouse_id')::uuid
              and product_id = v_product_id
              and quantity >= v_quantity
            returning quantity into v_warehouse_quantity;

            if not found then
              raise exception 'The primary warehouse does not have enough stock.';
            end if;
          end if;
        elsif coalesce(p_allow_out_of_stock, false) then
          insert into public.commerce_warehouse_inventory (
            warehouse_id,
            product_id,
            quantity,
            average_cost,
            updated_at
          )
          values (
            (v_item ->> 'primary_warehouse_id')::uuid,
            v_product_id,
            0,
            coalesce((v_item ->> 'unit_cost')::numeric, 0),
            now()
          )
          on conflict (warehouse_id, product_id)
          do update
          set updated_at = excluded.updated_at
          returning quantity into v_warehouse_quantity;
        else
          raise exception
            'The primary warehouse inventory row is missing for one of the products.';
        end if;
      end if;
    end if;

    if nullif(v_item ->> 'primary_warehouse_id', '') is not null
      and v_warehouse_quantity is not null
    then
      insert into public.commerce_inventory_movements (
        warehouse_id,
        product_id,
        movement_type,
        reference_type,
        reference_id,
        quantity_change,
        quantity_after,
        unit_cost,
        notes
      )
      values (
        (v_item ->> 'primary_warehouse_id')::uuid,
        v_product_id,
        'sale_out',
        'manual',
        v_order.id,
        -v_quantity,
        v_warehouse_quantity,
        coalesce((v_item ->> 'unit_cost')::numeric, 0),
        'Atomic online checkout.'
      );
    end if;
  end loop;

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

create or replace function public.commerce_return_serialized_unit(
  p_unit_id uuid,
  p_warehouse_id uuid,
  p_reason text,
  p_notes text default null,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_unit public.commerce_serialized_units%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_return_id uuid;
  v_warehouse_quantity integer;
begin
  if p_admin_id is null or not exists (
    select 1
    from public.admin_users as admins
    where admins.id = p_admin_id
      and admins.is_active
      and (
        admins.role = 'owner'
        or coalesce((admins.permissions ->> 'products.edit')::boolean, false)
      )
  ) then
    raise exception 'Not authorized to return serialized inventory.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A return reason is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses as warehouses
    where warehouses.id = p_warehouse_id
      and warehouses.is_active
  ) then
    raise exception 'A valid active warehouse is required.';
  end if;

  select units.*
  into v_unit
  from public.commerce_serialized_units as units
  where units.id = p_unit_id;

  if not found then
    raise exception 'The serialized inventory item was not found.';
  end if;

  select products.*
  into v_product
  from public.products as products
  where products.id = v_unit.product_id
  for update;

  if v_product.primary_warehouse_id is null
    or p_warehouse_id <> v_product.primary_warehouse_id
  then
    raise exception
      'Serialized returns must be received into the product primary warehouse.';
  end if;

  select variants.*
  into v_variant
  from public.product_variants as variants
  where variants.id = v_unit.variant_id
    and variants.product_id = v_unit.product_id
  for update;

  select units.*
  into v_unit
  from public.commerce_serialized_units as units
  where units.id = p_unit_id
  for update;

  if v_unit.status <> 'sold' then
    raise exception 'Only a currently sold physical item can be returned.';
  end if;

  if v_unit.customer_order_id is null
    or v_unit.customer_order_item_id is null
  then
    raise exception 'This sold item is not linked to a customer order.';
  end if;

  select items.*
  into v_order_item
  from public.customer_order_items as items
  where items.id = v_unit.customer_order_item_id
    and items.order_id = v_unit.customer_order_id
    and items.product_id = v_unit.product_id
  for update;

  if not found then
    raise exception 'The linked customer order item is invalid.';
  end if;

  perform set_config('app.serialized_inventory_write', 'on', true);

  insert into public.commerce_order_returns (
    order_id,
    warehouse_id,
    reason,
    notes,
    total_items,
    created_by
  )
  values (
    v_unit.customer_order_id,
    p_warehouse_id,
    btrim(p_reason),
    nullif(btrim(p_notes), ''),
    1,
    p_admin_id
  )
  returning id into v_return_id;

  insert into public.commerce_order_return_items (
    order_return_id,
    order_item_id,
    product_id,
    variant_id,
    serialized_unit_id,
    quantity,
    unit_price
  )
  values (
    v_return_id,
    v_unit.customer_order_item_id,
    v_unit.product_id,
    v_unit.variant_id,
    v_unit.id,
    1,
    coalesce(v_order_item.unit_price, 0)
  );

  update public.commerce_serialized_units
  set
    warehouse_id = p_warehouse_id,
    status = 'in_stock',
    returned_at = now(),
    updated_at = now()
  where id = v_unit.id;

  update public.product_variants
  set
    stock_quantity = stock_quantity + 1,
    updated_at = now()
  where id = v_unit.variant_id;

  update public.products
  set stock_quantity = stock_quantity + 1
  where id = v_unit.product_id;

  insert into public.commerce_warehouse_inventory (
    warehouse_id,
    product_id,
    quantity,
    average_cost,
    updated_at
  )
  values (
    p_warehouse_id,
    v_unit.product_id,
    1,
    coalesce(v_unit.unit_cost, v_product.cost_price, 0),
    now()
  )
  on conflict (warehouse_id, product_id)
  do update
  set
    quantity = commerce_warehouse_inventory.quantity + 1,
    updated_at = now()
  returning quantity into v_warehouse_quantity;

  insert into public.commerce_serialized_unit_movements (
    unit_id,
    product_id,
    variant_id,
    warehouse_id,
    customer_order_id,
    order_return_id,
    actor_admin_id,
    movement_type,
    from_status,
    to_status,
    notes
  )
  values (
    v_unit.id,
    v_unit.product_id,
    v_unit.variant_id,
    p_warehouse_id,
    v_unit.customer_order_id,
    v_return_id,
    p_admin_id,
    'returned',
    'sold',
    'in_stock',
    concat_ws(
      ' — ',
      btrim(p_reason),
      nullif(btrim(p_notes), '')
    )
  );

  insert into public.commerce_inventory_movements (
    warehouse_id,
    product_id,
    movement_type,
    reference_type,
    reference_id,
    quantity_change,
    quantity_after,
    unit_cost,
    notes,
    created_by
  )
  values (
    p_warehouse_id,
    v_unit.product_id,
    'return_in',
    'order_return',
    v_return_id,
    1,
    v_warehouse_quantity,
    coalesce(v_unit.unit_cost, v_product.cost_price, 0),
    concat_ws(
      ' — ',
      btrim(p_reason),
      nullif(btrim(p_notes), '')
    ),
    p_admin_id
  );

  return jsonb_build_object(
    'item_id', v_unit.id,
    'status', 'in_stock',
    'return_id', v_return_id
  );
end;
$function$;

drop trigger if exists products_guard_serialized_stock on public.products;
create trigger products_guard_serialized_stock
before insert or update
on public.products
for each row
execute function public.commerce_reject_serialized_stock_write();

drop trigger if exists product_variants_guard_serialized_stock
  on public.product_variants;
create trigger product_variants_guard_serialized_stock
before insert or update
on public.product_variants
for each row
execute function public.commerce_reject_serialized_stock_write();

drop trigger if exists commerce_warehouse_inventory_guard_serialized_stock
  on public.commerce_warehouse_inventory;
create trigger commerce_warehouse_inventory_guard_serialized_stock
before insert or update or delete
on public.commerce_warehouse_inventory
for each row
execute function public.commerce_reject_serialized_stock_write();

create or replace function public.commerce_reject_serialized_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception
    'Serialized inventory movement history is immutable and cannot be changed.';
end;
$function$;

drop trigger if exists commerce_serialized_movements_immutable_rows
  on public.commerce_serialized_unit_movements;
create trigger commerce_serialized_movements_immutable_rows
before update or delete
on public.commerce_serialized_unit_movements
for each row
execute function public.commerce_reject_serialized_movement_mutation();

drop trigger if exists commerce_serialized_movements_immutable_truncate
  on public.commerce_serialized_unit_movements;
create trigger commerce_serialized_movements_immutable_truncate
before truncate
on public.commerce_serialized_unit_movements
for each statement
execute function public.commerce_reject_serialized_movement_mutation();

create or replace function public.commerce_validate_order_return_item()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_order_product_id uuid;
  v_is_serialized boolean;
begin
  if new.order_item_id is null then
    raise exception 'A valid customer order item is required for every return.';
  end if;

  select items.product_id
  into v_order_product_id
  from public.customer_order_items as items
  where items.id = new.order_item_id;

  if not found or v_order_product_id is null then
    raise exception 'The selected customer order item is invalid.';
  end if;

  if new.product_id is null then
    new.product_id := v_order_product_id;
  elsif new.product_id <> v_order_product_id then
    raise exception
      'The supplied product does not match the selected customer order item.';
  end if;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = v_order_product_id;

  if v_is_serialized and new.serialized_unit_id is null then
    raise exception
      'Use the serialized inventory scanner to return this exact physical item.';
  end if;

  return new;
end;
$function$;

drop trigger if exists commerce_order_return_items_validate_product
  on public.commerce_order_return_items;
create trigger commerce_order_return_items_validate_product
before insert or update
on public.commerce_order_return_items
for each row
execute function public.commerce_validate_order_return_item();

-- Catalog variants are reference data only. This function never creates stock,
-- warehouse balances, serialized units, QR tokens, or inventory movements.
create or replace function public.commerce_define_product_variants(
  p_product_id uuid,
  p_variants jsonb,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_input jsonb;
  v_variant_id uuid;
  v_variant_name text;
  v_variant_code text;
  v_variant_sku text;
  v_color_name text;
  v_color_hex text;
  v_submitted_ids uuid[] := array[]::uuid[];
  v_resolved_inputs jsonb := '[]'::jsonb;
begin
  if p_admin_id is null or not exists (
    select 1
    from public.admin_users as admins
    where admins.id = p_admin_id
      and admins.is_active
      and (
        admins.role = 'owner'
        or coalesce((admins.permissions ->> 'products.add')::boolean, false)
        or coalesce((admins.permissions ->> 'products.edit')::boolean, false)
      )
  ) then
    raise exception 'Not authorized to define product variants.';
  end if;

  select products.*
  into v_product
  from public.products as products
  where products.id = p_product_id
  for update;

  if not found then
    raise exception 'A valid product is required.';
  end if;

  if not v_product.is_serialized then
    raise exception
      'Legacy aggregate-stock products must be reconciled before variants can be defined.';
  end if;

  if p_variants is null
    or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) = 0
  then
    raise exception 'At least one active product variant is required.';
  end if;

  if jsonb_array_length(p_variants) > 100 then
    raise exception 'A product cannot have more than 100 variants.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as rows(value)
    where rows.value ? 'quantity'
      or rows.value ? 'stock_quantity'
  ) then
    raise exception
      'Variant quantities cannot be defined in the catalog; receive physical items through Procurement.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as rows(value)
    group by lower(btrim(coalesce(rows.value ->> 'code', '')))
    having count(*) > 1
  ) then
    raise exception 'Every variant code must be unique within the product.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as rows(value)
    where nullif(btrim(rows.value ->> 'sku'), '') is not null
    group by lower(btrim(rows.value ->> 'sku'))
    having count(*) > 1
  ) then
    raise exception 'Every variant SKU must be unique.';
  end if;

  -- Lock the complete variant set so omission/deactivation cannot race with a
  -- receipt that is selecting one of these references.
  perform variants.id
  from public.product_variants as variants
  where variants.product_id = p_product_id
  order by variants.id
  for update;

  -- Resolve and validate every reference before changing any active state.
  -- Existing rows are identified explicitly by UUID, or by their currently
  -- active code when a new catalog payload has no UUID yet.
  for v_input in
    select rows.value
    from jsonb_array_elements(p_variants) as rows(value)
  loop
    v_variant_id := nullif(btrim(v_input ->> 'id'), '')::uuid;
    v_variant_name := btrim(coalesce(v_input ->> 'name', ''));
    v_variant_code := upper(btrim(coalesce(v_input ->> 'code', '')));
    v_variant_sku := nullif(btrim(v_input ->> 'sku'), '');
    v_color_name := nullif(btrim(v_input ->> 'color_name'), '');
    v_color_hex := nullif(btrim(v_input ->> 'color_hex'), '');

    if v_variant_name = '' or v_variant_code = '' then
      raise exception 'Every variant requires a name and code.';
    end if;

    if v_variant_code !~ '^[A-Z0-9_-]+$' then
      raise exception
        'Variant codes may only contain letters, numbers, underscores, and hyphens.';
    end if;

    if v_color_hex is not null
      and v_color_hex !~ '^#[0-9A-Fa-f]{6}$'
    then
      raise exception 'Variant colors must use a six-digit hex value.';
    end if;

    if v_variant_id is not null then
      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.id = v_variant_id
        and variants.product_id = p_product_id;

      if not found then
        raise exception 'One of the selected variants does not belong to this product.';
      end if;
    else
      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.product_id = p_product_id
        and variants.is_active
        and lower(variants.code) = lower(v_variant_code);

      if found then
        v_variant_id := v_variant.id;
      end if;
    end if;

    if v_variant_id is not null then
      if v_variant_id = any(v_submitted_ids) then
        raise exception 'The same variant reference cannot be submitted twice.';
      end if;

      v_submitted_ids := array_append(v_submitted_ids, v_variant_id);
    end if;

    v_resolved_inputs := v_resolved_inputs || jsonb_build_array(
      jsonb_build_object(
        'id', v_variant_id,
        'name', v_variant_name,
        'code', v_variant_code,
        'sku', v_variant_sku,
        'color_name', v_color_name,
        'color_hex', v_color_hex
      )
    );
  end loop;

  if exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = p_product_id
      and variants.is_active
      and not (variants.id = any(v_submitted_ids))
      and exists (
        select 1
        from public.commerce_serialized_units as units
        where units.variant_id = variants.id
      )
  ) then
    raise exception
      'A variant with physical item history cannot be removed from the active catalog.';
  end if;

  -- Two-phase replacement: first make the old reference set inactive, then
  -- apply the final submitted set. The active-only unique indexes make code/SKU
  -- swaps and reuse from an omitted historical variant safe and atomic.
  update public.product_variants
  set
    is_active = false,
    updated_at = now()
  where product_id = p_product_id
    and is_active;

  for v_input in
    select rows.value
    from jsonb_array_elements(v_resolved_inputs) as rows(value)
  loop
    v_variant_id := nullif(btrim(v_input ->> 'id'), '')::uuid;
    v_variant_name := v_input ->> 'name';
    v_variant_code := v_input ->> 'code';
    v_variant_sku := nullif(v_input ->> 'sku', '');
    v_color_name := nullif(v_input ->> 'color_name', '');
    v_color_hex := nullif(v_input ->> 'color_hex', '');

    if v_variant_id is not null then
      update public.product_variants
      set
        name = v_variant_name,
        code = v_variant_code,
        sku = v_variant_sku,
        color_name = v_color_name,
        color_hex = v_color_hex,
        is_active = true,
        updated_at = now()
      where id = v_variant_id
        and product_id = p_product_id
      returning * into v_variant;
    else
      insert into public.product_variants (
        product_id,
        name,
        code,
        sku,
        color_name,
        color_hex,
        price,
        cost_price,
        stock_quantity,
        is_active
      )
      values (
        p_product_id,
        v_variant_name,
        v_variant_code,
        v_variant_sku,
        v_color_name,
        v_color_hex,
        coalesce(v_product.price, 0),
        0,
        0,
        true
      )
      returning * into v_variant;
    end if;
  end loop;

  if not exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = p_product_id
      and variants.is_active
  ) then
    raise exception 'At least one active product variant is required.';
  end if;

  return jsonb_build_object(
    'product_id', p_product_id,
    'active_variant_count', (
      select count(*)::integer
      from public.product_variants as variants
      where variants.product_id = p_product_id
        and variants.is_active
    )
  );
end;
$function$;

-- Creating a procurement order is the sole physical-stock receiving path. The
-- order, lines, unit identities, opaque QR tokens, projections, and movement
-- history are committed atomically or rolled back together.
create or replace function public.commerce_create_procurement_order(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_invoice_number text,
  p_notes text,
  p_paid_amount numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_existing_order public.commerce_procurement_orders%rowtype;
  v_procurement_id uuid;
  v_procurement_item_id uuid;
  v_batch_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_inventory public.commerce_warehouse_inventory%rowtype;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_cost numeric(12, 2);
  v_line_total numeric(12, 2);
  v_total_cost numeric(12, 2) := 0;
  v_next_product_quantity integer;
  v_next_variant_quantity integer;
  v_next_warehouse_quantity integer;
  v_next_product_cost numeric(12, 2);
  v_next_variant_cost numeric(12, 2);
  v_next_warehouse_cost numeric(12, 2);
  v_inventory_exists boolean;
  v_invoice_number text;
  v_receipt_key text;
  v_payload_hash text;
  v_total_received_units bigint;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if p_supplier_id is null or not exists (
    select 1
    from public.commerce_crm_accounts as accounts
    where accounts.id = p_supplier_id
      and accounts.account_type = 'supplier'
      and accounts.is_active
  ) then
    raise exception 'A valid active supplier is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses as warehouses
    where warehouses.id = p_warehouse_id
      and warehouses.is_active
  ) then
    raise exception 'A valid active warehouse is required.';
  end if;

  v_invoice_number := nullif(btrim(p_invoice_number), '');

  if v_invoice_number is null then
    raise exception
      'An invoice or procurement reference is required to prevent duplicate receipts.';
  end if;

  if char_length(v_invoice_number) > 160 then
    raise exception 'The invoice or procurement reference cannot exceed 160 characters.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one procurement item is required.';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'A procurement order cannot contain more than 100 lines.';
  end if;

  if lower(coalesce(p_paid_amount, 0)::text) in (
    'nan',
    'infinity',
    '-infinity'
  ) or coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount must be a finite, non-negative number.';
  end if;

  select coalesce(
    sum(
      greatest(
        coalesce((rows.value ->> 'quantity')::bigint, 0),
        0
      )
    ),
    0
  )
  into v_total_received_units
  from jsonb_array_elements(p_items) as rows(value);

  if v_total_received_units > 10000 then
    raise exception
      'A procurement order cannot receive more than 10,000 physical units.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as rows(value)
    group by
      rows.value ->> 'product_id',
      rows.value ->> 'variant_id'
    having count(*) > 1
  ) then
    raise exception
      'The same product variant cannot be repeated on one procurement order.';
  end if;

  v_receipt_key := lower(p_supplier_id::text) || ':' || lower(v_invoice_number);
  v_payload_hash := md5(
    jsonb_build_object(
      'supplier_id', p_supplier_id,
      'warehouse_id', p_warehouse_id,
      'invoice_number', lower(v_invoice_number),
      'notes', nullif(btrim(p_notes), ''),
      'paid_amount', round(coalesce(p_paid_amount, 0), 2),
      'items', p_items
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_receipt_key, 0)
  );

  select orders.*
  into v_existing_order
  from public.commerce_procurement_orders as orders
  where orders.receipt_key = v_receipt_key
  limit 1;

  if found then
    if v_existing_order.receipt_payload_hash = v_payload_hash then
      return v_existing_order.id;
    end if;

    raise exception
      'This supplier invoice/reference was already received with different details.';
  end if;

  if exists (
    select 1
    from public.commerce_procurement_orders as orders
    where orders.supplier_id = p_supplier_id
      and lower(btrim(orders.invoice_number)) = lower(v_invoice_number)
      and orders.receipt_key is null
  ) then
    raise exception
      'This supplier invoice/reference already exists in procurement history.';
  end if;

  insert into public.commerce_procurement_orders (
    supplier_id,
    warehouse_id,
    invoice_number,
    notes,
    total_cost,
    paid_amount,
    receipt_key,
    receipt_payload_hash,
    created_by
  )
  values (
    p_supplier_id,
    p_warehouse_id,
    v_invoice_number,
    nullif(btrim(p_notes), ''),
    0,
    0,
    v_receipt_key,
    v_payload_hash,
    v_admin_id
  )
  returning id into v_procurement_id;

  perform set_config('app.serialized_inventory_write', 'on', true);

  for v_item in
    select rows.value
    from jsonb_array_elements(p_items) as rows(value)
    order by
      rows.value ->> 'product_id',
      rows.value ->> 'variant_id'
  loop
    v_product_id := nullif(btrim(v_item ->> 'product_id'), '')::uuid;
    v_variant_id := nullif(btrim(v_item ->> 'variant_id'), '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_cost := round(coalesce((v_item ->> 'unit_cost')::numeric, 0), 2);

    if v_product_id is null
      or v_variant_id is null
      or v_quantity < 1
      or v_quantity > 1000
      or lower(v_unit_cost::text) in ('nan', 'infinity', '-infinity')
      or v_unit_cost < 0
    then
      raise exception
        'Every procurement line requires a product, variant, quantity from 1 to 1,000, and non-negative unit cost.';
    end if;

    select products.*
    into v_product
    from public.products as products
    where products.id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    if not v_product.is_serialized then
      raise exception
        'This legacy product has untracked aggregate stock. Reconcile it before receiving new physical items.';
    end if;

    if v_product.primary_warehouse_id is null
      or v_product.primary_warehouse_id <> p_warehouse_id
    then
      raise exception
        'Every product must be received into its configured primary warehouse.';
    end if;

    select variants.*
    into v_variant
    from public.product_variants as variants
    where variants.id = v_variant_id
      and variants.product_id = v_product_id
      and variants.is_active
    for update;

    if not found then
      raise exception
        'One of the selected variants is inactive or does not belong to its product.';
    end if;

    v_line_total := round((v_quantity * v_unit_cost)::numeric, 2);
    v_total_cost := round((v_total_cost + v_line_total)::numeric, 2);

    insert into public.commerce_procurement_items (
      procurement_order_id,
      product_id,
      variant_id,
      quantity,
      received_quantity,
      unit_cost,
      line_total
    )
    values (
      v_procurement_id,
      v_product_id,
      v_variant_id,
      v_quantity,
      v_quantity,
      v_unit_cost,
      v_line_total
    )
    returning id into v_procurement_item_id;

    v_batch_id := gen_random_uuid();

    insert into public.commerce_serialized_inventory_batches (
      id,
      product_id,
      warehouse_id,
      procurement_order_id,
      procurement_item_id,
      created_count,
      variant_count,
      notes,
      created_by
    )
    values (
      v_batch_id,
      v_product_id,
      p_warehouse_id,
      v_procurement_id,
      v_procurement_item_id,
      v_quantity,
      1,
      nullif(btrim(p_notes), ''),
      v_admin_id
    );

    with unit_numbers as materialized (
      select nextval(
        'public.commerce_serialized_unit_code_seq'::regclass
      ) as unit_number
      from generate_series(1, v_quantity)
    ),
    inserted_units as (
      insert into public.commerce_serialized_units (
        batch_id,
        unit_code,
        product_id,
        variant_id,
        warehouse_id,
        status,
        unit_cost,
        procurement_order_id,
        procurement_item_id,
        created_by
      )
      select
        v_batch_id,
        format(
          'ELC-%s-%s-%s',
          coalesce(
            nullif(
              regexp_replace(
                upper(coalesce(v_product.sku, '')),
                '[^A-Z0-9_-]',
                '',
                'g'
              ),
              ''
            ),
            upper(substr(replace(v_product.id::text, '-', ''), 1, 8))
          ),
          regexp_replace(upper(v_variant.code), '[^A-Z0-9_-]', '', 'g'),
          lpad(unit_numbers.unit_number::text, 10, '0')
        ),
        v_product_id,
        v_variant_id,
        p_warehouse_id,
        'in_stock',
        v_unit_cost,
        v_procurement_id,
        v_procurement_item_id,
        v_admin_id
      from unit_numbers
      returning id
    )
      insert into public.commerce_serialized_unit_movements (
        unit_id,
        product_id,
        variant_id,
        warehouse_id,
        procurement_order_id,
        procurement_item_id,
        actor_admin_id,
        movement_type,
        from_status,
        to_status,
        notes
      )
      select
        inserted_units.id,
        v_product_id,
        v_variant_id,
        p_warehouse_id,
        v_procurement_id,
        v_procurement_item_id,
        v_admin_id,
        'received',
        null,
        'in_stock',
        concat_ws(
          ' — ',
          'Received through Procurement ' || v_invoice_number,
          nullif(btrim(p_notes), '')
        )
      from inserted_units;

    v_next_variant_quantity :=
      coalesce(v_variant.stock_quantity, 0) + v_quantity;
    v_next_variant_cost := round(
      (
        (
          coalesce(v_variant.cost_price, 0)
          * greatest(coalesce(v_variant.stock_quantity, 0), 0)
        )
        + (v_unit_cost * v_quantity)
      ) / v_next_variant_quantity,
      2
    );

    update public.product_variants
    set
      stock_quantity = v_next_variant_quantity,
      cost_price = v_next_variant_cost,
      updated_at = now()
    where id = v_variant_id;

    v_next_product_quantity :=
      coalesce(v_product.stock_quantity, 0) + v_quantity;
    v_next_product_cost := round(
      (
        (
          coalesce(v_product.cost_price, 0)
          * greatest(coalesce(v_product.stock_quantity, 0), 0)
        )
        + (v_unit_cost * v_quantity)
      ) / v_next_product_quantity,
      2
    );

    update public.products
    set
      stock_quantity = v_next_product_quantity,
      cost_price = v_next_product_cost
    where id = v_product_id;

    select inventory.*
    into v_inventory
    from public.commerce_warehouse_inventory as inventory
    where inventory.warehouse_id = p_warehouse_id
      and inventory.product_id = v_product_id
    for update;

    v_inventory_exists := found;

    if v_inventory_exists then
      v_next_warehouse_quantity :=
        coalesce(v_inventory.quantity, 0) + v_quantity;
      v_next_warehouse_cost := round(
        (
          (
            coalesce(v_inventory.average_cost, 0)
            * greatest(coalesce(v_inventory.quantity, 0), 0)
          )
          + (v_unit_cost * v_quantity)
        ) / v_next_warehouse_quantity,
        2
      );

      update public.commerce_warehouse_inventory
      set
        quantity = v_next_warehouse_quantity,
        average_cost = v_next_warehouse_cost,
        updated_at = now()
      where id = v_inventory.id;
    else
      v_next_warehouse_quantity := v_quantity;
      v_next_warehouse_cost := v_unit_cost;

      insert into public.commerce_warehouse_inventory (
        warehouse_id,
        product_id,
        quantity,
        average_cost,
        updated_at
      )
      values (
        p_warehouse_id,
        v_product_id,
        v_quantity,
        v_unit_cost,
        now()
      );
    end if;

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_warehouse_id,
      v_product_id,
      'procurement',
      'procurement_order',
      v_procurement_id,
      v_quantity,
      v_next_warehouse_quantity,
      v_unit_cost,
      concat_ws(
        ' — ',
        v_variant.name,
        nullif(btrim(p_notes), '')
      ),
      v_admin_id
    );
  end loop;

  if round(coalesce(p_paid_amount, 0), 2) > v_total_cost then
    raise exception 'Paid amount cannot be greater than the procurement total.';
  end if;

  update public.commerce_procurement_orders
  set
    total_cost = v_total_cost,
    paid_amount = round(coalesce(p_paid_amount, 0), 2),
    updated_at = now()
  where id = v_procurement_id;

  return v_procurement_id;
end;
$function$;

create or replace function public.commerce_guard_serialized_procurement_item()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_product_id uuid;
  v_is_serialized boolean;
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  v_product_id := case
    when tg_op = 'DELETE' then old.product_id
    else new.product_id
  end;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = v_product_id;

  if tg_op in ('INSERT', 'UPDATE') and v_is_serialized then
    raise exception
      'Create or change tracked procurement lines only through the Procurement order function.';
  end if;

  if tg_op in ('UPDATE', 'DELETE')
    and old.received_quantity > 0
  then
    raise exception
      'A received procurement line is immutable because physical unit IDs were generated from it.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

drop trigger if exists commerce_procurement_items_guard_serialized_receipt
  on public.commerce_procurement_items;
create trigger commerce_procurement_items_guard_serialized_receipt
before insert or update or delete
on public.commerce_procurement_items
for each row
execute function public.commerce_guard_serialized_procurement_item();

create or replace function public.commerce_guard_received_procurement_order()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    return new;
  end if;

  if exists (
    select 1
    from public.commerce_procurement_items as items
    where items.procurement_order_id = old.id
      and items.received_quantity > 0
  )
    and (
      new.supplier_id is distinct from old.supplier_id
      or new.warehouse_id is distinct from old.warehouse_id
      or new.invoice_number is distinct from old.invoice_number
      or new.total_cost is distinct from old.total_cost
      or new.receipt_key is distinct from old.receipt_key
      or new.receipt_payload_hash is distinct from old.receipt_payload_hash
    )
  then
    raise exception
      'A received procurement order cannot change its supplier, warehouse, reference, or received total.';
  end if;

  return new;
end;
$function$;

drop trigger if exists commerce_procurement_orders_guard_received_identity
  on public.commerce_procurement_orders;
create trigger commerce_procurement_orders_guard_received_identity
before update
on public.commerce_procurement_orders
for each row
execute function public.commerce_guard_received_procurement_order();

-- Physical units may no longer be created from catalog or a manual inventory
-- batch. Keeping no alternate executable path makes Procurement authoritative.
drop function if exists public.commerce_add_serialized_inventory(
  uuid,
  uuid,
  jsonb,
  text,
  uuid
);

alter table public.product_variants enable row level security;
alter table public.commerce_serialized_inventory_batches enable row level security;
alter table public.commerce_serialized_units enable row level security;
alter table public.commerce_serialized_unit_movements enable row level security;

drop policy if exists product_variants_public_read
  on public.product_variants;
create policy product_variants_public_read
on public.product_variants
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.products as products
    where products.id = product_variants.product_id
      and products.is_published
  )
);

drop policy if exists product_variants_admin_read
  on public.product_variants;
create policy product_variants_admin_read
on public.product_variants
for select
to authenticated
using (public.is_active_admin());

revoke all on table public.product_variants
from public, anon, authenticated, service_role;
grant select on table public.product_variants to anon, authenticated;
grant select on table public.product_variants to service_role;

revoke all
on table public.commerce_serialized_inventory_batches
from public, anon, authenticated, service_role;
revoke all
on table public.commerce_serialized_units
from public, anon, authenticated, service_role;
revoke all
on table public.commerce_serialized_unit_movements
from public, anon, authenticated, service_role;

grant select on table public.commerce_serialized_inventory_batches
to service_role;
grant select on table public.commerce_serialized_units to service_role;
grant select on table public.commerce_serialized_unit_movements
to service_role;

revoke all
on sequence public.commerce_serialized_unit_code_seq
from public, anon, authenticated, service_role;

revoke all on function public.commerce_create_customer_order(
  uuid,
  jsonb,
  jsonb,
  boolean,
  uuid
) from public, anon, authenticated;
grant execute on function public.commerce_create_customer_order(
  uuid,
  jsonb,
  jsonb,
  boolean,
  uuid
) to service_role;

revoke all on function public.commerce_define_product_variants(
  uuid,
  jsonb,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.commerce_define_product_variants(
  uuid,
  jsonb,
  uuid
) to service_role;

revoke all on function public.commerce_create_procurement_order(
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.commerce_create_procurement_order(
  uuid,
  uuid,
  text,
  text,
  numeric,
  jsonb
) to authenticated;

revoke all on function public.commerce_return_serialized_unit(
  uuid,
  uuid,
  text,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.commerce_return_serialized_unit(
  uuid,
  uuid,
  text,
  text,
  uuid
) to service_role;

revoke all on function public.commerce_reject_serialized_stock_write()
from public, anon, authenticated;
revoke all on function public.commerce_reject_serialized_movement_mutation()
from public, anon, authenticated;
revoke all on function public.commerce_validate_order_return_item()
from public, anon, authenticated;
revoke all on function public.commerce_guard_serialized_procurement_item()
from public, anon, authenticated;
revoke all on function public.commerce_guard_received_procurement_order()
from public, anon, authenticated;

commit;
