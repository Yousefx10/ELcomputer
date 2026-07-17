begin;

create or replace function public.default_admin_permissions () returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'dashboard.view', false,
    'dashboard.analysis', false,
    'dashboard.orders', false,
    'products.view', false,
    'products.add', false,
    'products.edit', false,
    'categories.view', false,
    'categories.add', false,
    'categories.edit', false,
    'brands.view', false,
    'brands.add', false,
    'brands.edit', false,
    'settings.view', false,
    'settings.edit', false,
    'settings.coupons', false,
    'users.view', false
  );
$$;

update public.admin_users
set permissions = permissions - 'settings.inventory'
where permissions ? 'settings.inventory';

alter table public.commerce_procurement_orders
add column if not exists paid_amount numeric (12, 2) not null default 0;

alter table public.commerce_procurement_orders
drop constraint if exists commerce_procurement_orders_paid_amount_check;

alter table public.commerce_procurement_orders
add constraint commerce_procurement_orders_paid_amount_check
check (paid_amount >= 0 and paid_amount <= total_cost);

alter table public.commerce_inventory_movements
drop constraint if exists commerce_inventory_movements_movement_type_check;

alter table public.commerce_inventory_movements
add constraint commerce_inventory_movements_movement_type_check
check (movement_type = any (array[
  'procurement'::text,
  'sale_out'::text,
  'transfer_in'::text,
  'transfer_out'::text,
  'return_in'::text,
  'adjustment'::text
]));

alter table public.commerce_inventory_movements
drop constraint if exists commerce_inventory_movements_reference_type_check;

alter table public.commerce_inventory_movements
add constraint commerce_inventory_movements_reference_type_check
check (
  reference_type is null
  or reference_type = any (array[
    'procurement_order'::text,
    'sales_order'::text,
    'warehouse_transfer'::text,
    'order_return'::text,
    'manual'::text
  ])
);

create table if not exists public.commerce_sales_orders (
  id uuid not null default gen_random_uuid (),
  customer_id uuid not null,
  warehouse_id uuid not null,
  order_number text null,
  notes text null,
  total_amount numeric (12, 2) not null default 0,
  paid_amount numeric (12, 2) not null default 0,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_sales_orders_pkey primary key (id),
  constraint commerce_sales_orders_customer_id_fkey foreign key (customer_id) references public.commerce_crm_accounts (id) on delete restrict,
  constraint commerce_sales_orders_warehouse_id_fkey foreign key (warehouse_id) references public.commerce_warehouses (id) on delete restrict,
  constraint commerce_sales_orders_created_by_fkey foreign key (created_by) references public.admin_users (id) on delete set null,
  constraint commerce_sales_orders_total_amount_check check (total_amount >= 0),
  constraint commerce_sales_orders_paid_amount_check check (paid_amount >= 0 and paid_amount <= total_amount)
);

create unique index if not exists commerce_sales_orders_order_number_uidx
on public.commerce_sales_orders (order_number)
where order_number is not null;

create index if not exists commerce_sales_orders_customer_created_idx
on public.commerce_sales_orders (customer_id, created_at desc);

create table if not exists public.commerce_sales_items (
  id uuid not null default gen_random_uuid (),
  sales_order_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  unit_price numeric (12, 2) not null default 0,
  line_total numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  constraint commerce_sales_items_pkey primary key (id),
  constraint commerce_sales_items_sales_order_id_fkey foreign key (sales_order_id) references public.commerce_sales_orders (id) on delete cascade,
  constraint commerce_sales_items_product_id_fkey foreign key (product_id) references public.products (id) on delete restrict,
  constraint commerce_sales_items_quantity_check check (quantity > 0),
  constraint commerce_sales_items_unit_price_check check (unit_price >= 0),
  constraint commerce_sales_items_line_total_check check (line_total >= 0)
);

create index if not exists commerce_sales_items_order_idx
on public.commerce_sales_items (sales_order_id, created_at);

drop function if exists public.commerce_create_procurement_order(uuid, uuid, text, text, jsonb);

create or replace function public.commerce_create_procurement_order (
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_invoice_number text,
  p_notes text,
  p_paid_amount numeric,
  p_items jsonb
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_procurement_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_cost numeric (12, 2);
  v_line_total numeric (12, 2);
  v_total_cost numeric (12, 2) := 0;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_inventory_exists boolean := false;
  v_next_product_stock integer;
  v_next_product_cost numeric (12, 2);
  v_next_inventory_quantity integer;
  v_next_inventory_average_cost numeric (12, 2);
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_supplier_id is null or not exists (
    select 1
    from public.commerce_crm_accounts
    where id = p_supplier_id
      and account_type = 'supplier'
      and is_active = true
  ) then
    raise exception 'A valid supplier is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one procurement item is required.';
  end if;

  if coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount cannot be negative.';
  end if;

  insert into public.commerce_procurement_orders (
    supplier_id,
    warehouse_id,
    invoice_number,
    notes,
    total_cost,
    created_by
  )
  values (
    p_supplier_id,
    p_warehouse_id,
    nullif(trim(p_invoice_number), ''),
    nullif(trim(p_notes), ''),
    0,
    auth.uid ()
  )
  returning id into v_procurement_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_cost := round(coalesce((v_item ->> 'unit_cost')::numeric, 0), 2);

    if v_product_id is null or v_quantity <= 0 or v_unit_cost < 0 then
      raise exception 'Every procurement line requires a valid product, quantity, and cost.';
    end if;

    select *
    into v_product_record
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    select *
    into v_inventory_record
    from public.commerce_warehouse_inventory
    where warehouse_id = p_warehouse_id
      and product_id = v_product_id
    for update;

    v_inventory_exists := found;

    v_line_total := round((v_quantity * v_unit_cost)::numeric, 2);
    v_total_cost := round((v_total_cost + v_line_total)::numeric, 2);
    v_next_product_stock := coalesce(v_product_record.stock_quantity, 0) + v_quantity;

    v_next_product_cost := case
      when v_next_product_stock > 0 then round((
        (
          coalesce(v_product_record.cost_price, 0) * greatest(coalesce(v_product_record.stock_quantity, 0), 0)
        ) + (v_unit_cost * v_quantity)
      ) / v_next_product_stock, 2)
      else v_unit_cost
    end;

    update public.products
    set
      stock_quantity = v_next_product_stock,
      cost_price = v_next_product_cost
    where id = v_product_id;

    if v_inventory_exists then
      v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) + v_quantity;
      v_next_inventory_average_cost := case
        when v_next_inventory_quantity > 0 then round((
          (
            coalesce(v_inventory_record.average_cost, 0) * greatest(coalesce(v_inventory_record.quantity, 0), 0)
          ) + (v_unit_cost * v_quantity)
        ) / v_next_inventory_quantity, 2)
        else v_unit_cost
      end;

      update public.commerce_warehouse_inventory
      set
        quantity = v_next_inventory_quantity,
        average_cost = v_next_inventory_average_cost,
        updated_at = now()
      where id = v_inventory_record.id;
    else
      v_next_inventory_quantity := v_quantity;
      v_next_inventory_average_cost := v_unit_cost;

      insert into public.commerce_warehouse_inventory (
        warehouse_id,
        product_id,
        quantity,
        average_cost
      )
      values (
        p_warehouse_id,
        v_product_id,
        v_next_inventory_quantity,
        v_next_inventory_average_cost
      );
    end if;

    insert into public.commerce_procurement_items (
      procurement_order_id,
      product_id,
      quantity,
      unit_cost,
      line_total
    )
    values (
      v_procurement_id,
      v_product_id,
      v_quantity,
      v_unit_cost,
      v_line_total
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
      v_product_id,
      'procurement',
      'procurement_order',
      v_procurement_id,
      v_quantity,
      v_next_inventory_quantity,
      v_unit_cost,
      nullif(trim(p_notes), ''),
      auth.uid ()
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
$$;

create or replace function public.commerce_create_sales_order (
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_number text,
  p_notes text,
  p_paid_amount numeric,
  p_items jsonb
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_sales_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric (12, 2);
  v_line_total numeric (12, 2);
  v_total_amount numeric (12, 2) := 0;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_next_product_stock integer;
  v_next_inventory_quantity integer;
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_customer_id is null or not exists (
    select 1
    from public.commerce_crm_accounts
    where id = p_customer_id
      and account_type = 'customer'
      and is_active = true
  ) then
    raise exception 'A valid CRM customer is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one sales item is required.';
  end if;

  if coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount cannot be negative.';
  end if;

  insert into public.commerce_sales_orders (
    customer_id,
    warehouse_id,
    order_number,
    notes,
    total_amount,
    paid_amount,
    created_by
  )
  values (
    p_customer_id,
    p_warehouse_id,
    nullif(trim(p_order_number), ''),
    nullif(trim(p_notes), ''),
    0,
    0,
    auth.uid ()
  )
  returning id into v_sales_order_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_price := round(coalesce((v_item ->> 'unit_price')::numeric, 0), 2);

    if v_product_id is null or v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Every sales line requires a valid product, quantity, and price.';
    end if;

    select *
    into v_product_record
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    select *
    into v_inventory_record
    from public.commerce_warehouse_inventory
    where warehouse_id = p_warehouse_id
      and product_id = v_product_id
    for update;

    if not found or coalesce(v_inventory_record.quantity, 0) < v_quantity then
      raise exception 'Insufficient warehouse stock for %.', v_product_record.title;
    end if;

    if coalesce(v_product_record.stock_quantity, 0) < v_quantity then
      raise exception 'Insufficient product stock for %.', v_product_record.title;
    end if;

    v_line_total := round((v_quantity * v_unit_price)::numeric, 2);
    v_total_amount := round((v_total_amount + v_line_total)::numeric, 2);
    v_next_product_stock := coalesce(v_product_record.stock_quantity, 0) - v_quantity;
    v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) - v_quantity;

    update public.products
    set stock_quantity = v_next_product_stock
    where id = v_product_id;

    update public.commerce_warehouse_inventory
    set
      quantity = v_next_inventory_quantity,
      updated_at = now()
    where id = v_inventory_record.id;

    insert into public.commerce_sales_items (
      sales_order_id,
      product_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_sales_order_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_line_total
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
      v_product_id,
      'sale_out',
      'sales_order',
      v_sales_order_id,
      -v_quantity,
      v_next_inventory_quantity,
      coalesce(v_inventory_record.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );
  end loop;

  if round(coalesce(p_paid_amount, 0), 2) > v_total_amount then
    raise exception 'Paid amount cannot be greater than the sales total.';
  end if;

  update public.commerce_sales_orders
  set
    total_amount = v_total_amount,
    paid_amount = round(coalesce(p_paid_amount, 0), 2),
    updated_at = now()
  where id = v_sales_order_id;

  return v_sales_order_id;
end;
$$;

create or replace function public.commerce_get_crm_account_summary (
  p_account_id uuid
) returns jsonb language plpgsql security definer stable
set
  search_path = public as $$
declare
  v_account_type text;
  v_order_count bigint := 0;
  v_total_amount numeric (12, 2) := 0;
  v_paid_amount numeric (12, 2) := 0;
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  select account_type
  into v_account_type
  from public.commerce_crm_accounts
  where id = p_account_id;

  if not found then
    raise exception 'CRM account not found.';
  end if;

  if v_account_type = 'supplier' then
    select
      count(*),
      coalesce(sum(total_cost), 0),
      coalesce(sum(paid_amount), 0)
    into
      v_order_count,
      v_total_amount,
      v_paid_amount
    from public.commerce_procurement_orders
    where supplier_id = p_account_id;
  else
    select
      count(*),
      coalesce(sum(total_amount), 0),
      coalesce(sum(paid_amount), 0)
    into
      v_order_count,
      v_total_amount,
      v_paid_amount
    from public.commerce_sales_orders
    where customer_id = p_account_id;
  end if;

  return jsonb_build_object(
    'order_count', v_order_count,
    'total_amount', v_total_amount,
    'paid_amount', v_paid_amount,
    'settlement_due', greatest(v_total_amount - v_paid_amount, 0)
  );
end;
$$;


alter table public.commerce_sales_orders enable row level security;
alter table public.commerce_sales_items enable row level security;

drop policy if exists "Admins can manage sales orders" on public.commerce_sales_orders;
create policy "Admins can manage sales orders"
on public.commerce_sales_orders
for all
to authenticated
using (public.is_active_admin ())
with check (public.is_active_admin ());

drop policy if exists "Admins can manage sales items" on public.commerce_sales_items;
create policy "Admins can manage sales items"
on public.commerce_sales_items
for all
to authenticated
using (public.is_active_admin ())
with check (public.is_active_admin ());

commit;

