begin;

-- Run the older stock-projection trigger with table-owner visibility so row
-- policies cannot hide a tracked product from its own integrity check.
alter function public.commerce_reject_serialized_stock_write()
security definer;

-- Product and variant acquisition costs are inventory projections. Catalog
-- writes always start at zero; Procurement is the authoritative writer.
create or replace function public.commerce_guard_inventory_cost_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_is_serialized boolean;
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    return new;
  end if;

  if tg_table_name = 'products' then
    if (
      tg_op = 'INSERT'
      and coalesce(new.cost_price, 0) <> 0
    ) or (
      tg_op = 'UPDATE'
      and new.cost_price is distinct from old.cost_price
    ) then
      raise exception
        'Product cost is calculated from Procurement receipts and cannot be edited in the catalog.';
    end if;

    return new;
  end if;

  if tg_table_name = 'product_variants' then
    if (
      tg_op = 'INSERT'
      and coalesce(new.cost_price, 0) <> 0
    ) or (
      tg_op = 'UPDATE'
      and new.cost_price is distinct from old.cost_price
    ) then
      raise exception
        'Variant cost is calculated from Procurement receipts and cannot be edited in the catalog.';
    end if;

    return new;
  end if;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = new.product_id;

  if coalesce(v_is_serialized, false)
    and (
      (
        tg_op = 'INSERT'
        and coalesce(new.average_cost, 0) <> 0
      )
      or (
        tg_op = 'UPDATE'
        and new.average_cost is distinct from old.average_cost
      )
    )
  then
    raise exception
      'Warehouse average cost is calculated from Procurement receipts.';
  end if;

  return new;
end;
$function$;

drop trigger if exists products_guard_inventory_cost_projection
  on public.products;
create trigger products_guard_inventory_cost_projection
before insert or update
on public.products
for each row
execute function public.commerce_guard_inventory_cost_projection();

drop trigger if exists product_variants_guard_inventory_cost_projection
  on public.product_variants;
create trigger product_variants_guard_inventory_cost_projection
before insert or update
on public.product_variants
for each row
execute function public.commerce_guard_inventory_cost_projection();

drop trigger if exists warehouse_inventory_guard_cost_projection
  on public.commerce_warehouse_inventory;
create trigger warehouse_inventory_guard_cost_projection
before insert or update
on public.commerce_warehouse_inventory
for each row
execute function public.commerce_guard_inventory_cost_projection();

-- Every catalog product always has an active variant reference. This also
-- gives unreconciled legacy-stock products a safe Default reference without
-- inventing physical item IDs, quantities, QR codes, or inventory history.
insert into public.product_variants (
  product_id,
  name,
  code,
  color_name,
  color_hex,
  price,
  cost_price,
  stock_quantity,
  is_active
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
  end,
  coalesce(products.price, 0),
  0,
  0,
  true
from public.products as products
where not exists (
  select 1
  from public.product_variants as variants
  where variants.product_id = products.id
    and variants.is_active
);

create or replace function public.commerce_create_default_product_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = new.id
      and variants.is_active
  )
  then
    insert into public.product_variants (
      product_id,
      name,
      code,
      color_name,
      color_hex,
      price,
      cost_price,
      stock_quantity,
      is_active
    )
    values (
      new.id,
      coalesce(nullif(btrim(new.color_name), ''), 'Default'),
      coalesce(
        nullif(
          regexp_replace(
            upper(coalesce(new.color_name, '')),
            '[^A-Z0-9_-]',
            '',
            'g'
          ),
          ''
        ),
        'DEFAULT'
      ),
      nullif(btrim(new.color_name), ''),
      case
        when new.color_hex ~ '^#[0-9A-Fa-f]{6}$'
          then new.color_hex
        else null
      end,
      coalesce(new.price, 0),
      0,
      0,
      true
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists products_create_default_variant on public.products;
create trigger products_create_default_variant
after insert
on public.products
for each row
execute function public.commerce_create_default_product_variant();

create or replace function public.commerce_require_active_product_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_primary_product_id uuid;
  v_product_id uuid;
  v_other_product_id uuid;
begin
  v_primary_product_id := case
    when tg_op = 'DELETE' then old.product_id
    else new.product_id
  end;

  if tg_op = 'UPDATE'
    and old.product_id is distinct from new.product_id
  then
    v_other_product_id := old.product_id;
  end if;

  -- Serialize every variant-set mutation through its parent product. Without
  -- this lock, two concurrent transactions could each deactivate a different
  -- active variant and both observe the other's uncommitted row as active.
  for v_product_id in
    select candidate_ids.product_id
    from unnest(array[v_primary_product_id, v_other_product_id]) as candidate_ids(product_id)
    where candidate_ids.product_id is not null
    group by candidate_ids.product_id
    order by candidate_ids.product_id
  loop
    perform products.id
    from public.products as products
    where products.id = v_product_id
    for update;

    if found and not exists (
      select 1
      from public.product_variants as variants
      where variants.product_id = v_product_id
        and variants.is_active
    ) then
      raise exception
        'Every product requires at least one active variant.';
    end if;
  end loop;

  return null;
end;
$function$;

drop trigger if exists product_variants_require_active_reference
  on public.product_variants;
create constraint trigger product_variants_require_active_reference
after insert or update or delete
on public.product_variants
deferrable initially deferred
for each row
execute function public.commerce_require_active_product_variant();

-- Extra gallery images belong to a specific saved variant. Existing ambiguous
-- images remain visible to admins for mapping, but new/edited rows must have a
-- valid variant reference.
alter table public.product_images
  add column if not exists variant_id uuid;

create unique index if not exists product_variants_product_id_id_uidx
  on public.product_variants (product_id, id);

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_images_product_variant_fkey'
      and conrelid = 'public.product_images'::regclass
  ) then
    alter table public.product_images
      add constraint product_images_product_variant_fkey
      foreign key (product_id, variant_id)
      references public.product_variants (product_id, id)
      on delete restrict;
  end if;
end;
$migration$;

create index if not exists product_images_variant_sort_idx
  on public.product_images (variant_id, sort_order, created_at);

with single_active_variants as (
  select
    variants.product_id,
    (array_agg(variants.id order by variants.id))[1] as variant_id
  from public.product_variants as variants
  where variants.is_active
  group by variants.product_id
  having count(*) = 1
)
update public.product_images as images
set variant_id = single_active_variants.variant_id
from single_active_variants
where images.product_id = single_active_variants.product_id
  and images.variant_id is null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_images_variant_required_check'
      and conrelid = 'public.product_images'::regclass
  ) then
    alter table public.product_images
      add constraint product_images_variant_required_check
      check (variant_id is not null)
      not valid;
  end if;
end;
$migration$;

create or replace function public.commerce_validate_product_image_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_variant public.product_variants%rowtype;
begin
  if new.variant_id is null then
    raise exception 'Select a variant for every extra product image.';
  end if;

  select variants.*
  into v_variant
  from public.product_variants as variants
  where variants.id = new.variant_id
  for share;

  if not found
    or v_variant.product_id <> new.product_id
  then
    raise exception
      'The selected image variant does not belong to this product.';
  end if;

  if not v_variant.is_active then
    raise exception
      'Extra images can only be assigned to an active product variant.';
  end if;

  return new;
end;
$function$;

drop trigger if exists product_images_validate_variant
  on public.product_images;
create trigger product_images_validate_variant
before insert or update
on public.product_images
for each row
execute function public.commerce_validate_product_image_variant();

create or replace function public.commerce_keep_image_variant_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.product_images as images
    where images.variant_id = new.id
  )
    and not exists (
      select 1
      from public.product_variants as variants
      where variants.id = new.id
        and variants.is_active
    )
  then
    raise exception
      'Move or delete this variant''s extra images before deactivating it.';
  end if;

  return null;
end;
$function$;

drop trigger if exists product_variants_keep_image_reference_active
  on public.product_variants;
create constraint trigger product_variants_keep_image_reference_active
after update of is_active
on public.product_variants
deferrable initially deferred
for each row
execute function public.commerce_keep_image_variant_active();

drop policy if exists "Public can read images for published products"
  on public.product_images;
create policy "Public can read images for published products"
on public.product_images
for select
to public
using (
  (
    exists (
      select 1
      from public.products as products
      join public.product_variants as variants
        on variants.product_id = products.id
       and variants.id = product_images.variant_id
       and variants.is_active
      where products.id = product_images.product_id
        and products.is_published
    )
  )
  or public.has_admin_permission('products.view')
  or public.has_admin_permission('products.edit')
);

revoke all on function public.commerce_guard_inventory_cost_projection()
from public, anon, authenticated;
revoke all on function public.commerce_create_default_product_variant()
from public, anon, authenticated;
revoke all on function public.commerce_require_active_product_variant()
from public, anon, authenticated;
revoke all on function public.commerce_validate_product_image_variant()
from public, anon, authenticated;
revoke all on function public.commerce_keep_image_variant_active()
from public, anon, authenticated;

commit;
