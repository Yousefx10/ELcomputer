begin;
set local lock_timeout = '5s';

-- Private editorial metadata. No catalog values, costs or credentials are stored.
create schema catalog_private;
revoke all on schema catalog_private from public, anon, authenticated, service_role;
create table catalog_private.product_revisions (
  -- Retain the generation tombstone after deletion, like the save receipt.
  -- No new external FK may block the existing guarded catalog/full resets.
  product_id uuid primary key,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991)
);
create table catalog_private.product_save_receipts (
  request_id uuid primary key,
  actor_id uuid not null,
  operation text not null check (operation in ('create','update')),
  product_id uuid not null,
  expected_revision bigint,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  result_revision bigint not null,
  audit_id uuid not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table catalog_private.product_revisions enable row level security;
alter table catalog_private.product_save_receipts enable row level security;
revoke all on catalog_private.product_revisions, catalog_private.product_save_receipts
  from public, anon, authenticated, service_role;
insert into catalog_private.product_revisions(product_id) select id from public.products;

-- Advance on ordinary catalog writes, including existing direct staff/variant writes.
-- Inventory projection and rating updates do not invalidate editorial snapshots.
create function catalog_private.track_product_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and not (not old.is_serialized and old.stock_quantity is distinct from new.stock_quantity) and
    (to_jsonb(old)-array['stock_quantity','cost_price','popularity_score','average_rating','created_at'])
      is not distinct from
    (to_jsonb(new)-array['stock_quantity','cost_price','popularity_score','average_rating','created_at']) then
    return null;
  end if;
  insert into catalog_private.product_revisions(product_id,revision) values(new.id,1)
    on conflict(product_id) do update set revision=catalog_private.product_revisions.revision+1;
  return null;
end $$;
create trigger catalog_product_revision after insert or update on public.products
  for each row execute function catalog_private.track_product_revision();

create function catalog_private.track_variant_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; tracked_id uuid;
begin
  if tg_op='UPDATE' and
    (to_jsonb(old)-array['stock_quantity','cost_price','price','updated_at','created_at'])
      is not distinct from
    (to_jsonb(new)-array['stock_quantity','cost_price','price','updated_at','created_at']) then
    return null;
  end if;
  ids:=case when tg_op='INSERT' then array[new.product_id]
    when tg_op='DELETE' then array[old.product_id] else array[old.product_id,new.product_id] end;
  for tracked_id in select distinct x from unnest(ids) x order by x loop
    -- Deletion retains minimal generation/receipt tombstones without catalog values.
    if exists(select 1 from public.products p where p.id=tracked_id) then
      insert into catalog_private.product_revisions(product_id,revision) values(tracked_id,1)
        on conflict(product_id) do update set revision=catalog_private.product_revisions.revision+1;
    end if;
  end loop;
  return null;
end $$;
create trigger catalog_variant_revision after insert or update or delete on public.product_variants
  for each row execute function catalog_private.track_variant_revision();

-- One statement snapshot: product, active definitions and generation agree.
create function public.catalog_product_edit_snapshot(p_admin_id uuid,p_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.admin_users%rowtype; result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not (a.role='owner' or (coalesce((a.permissions->>'products.view')::boolean,false)
    and coalesce((a.permissions->>'products.edit')::boolean,false))) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  select jsonb_build_object('product',to_jsonb(p),'revision',r.revision,
    'variants',coalesce((select jsonb_agg(to_jsonb(v) order by v.name,v.id)
      from public.product_variants v where v.product_id=p.id and v.is_active),'[]'::jsonb))
    into result from public.products p join catalog_private.product_revisions r on r.product_id=p.id
    where p.id=p_product_id and (p.is_published or a.role='owner'
      or coalesce((a.permissions->>'products.view')::boolean,false));
  if result is null then raise exception 'catalog:not_found' using errcode='P0002';end if;
  return result;
end $$;

-- Recovery exposes only this actor's completed receipt, never catalog values.
create function public.catalog_product_save_status(p_admin_id uuid,p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.admin_users%rowtype; r catalog_private.product_save_receipts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'catalog:permission' using errcode='42501';end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not (a.role='owner' or (coalesce((a.permissions->>'products.view')::boolean,false)
    and (coalesce((a.permissions->>'products.add')::boolean,false)
      or coalesce((a.permissions->>'products.edit')::boolean,false)))) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  select * into r from catalog_private.product_save_receipts where request_id=p_request_id and actor_id=p_admin_id;
  if not found then return null;end if;
  if not (a.role='owner' or (coalesce((a.permissions->>'products.view')::boolean,false)
    and coalesce((a.permissions->>('products.'||case r.operation when 'create' then 'add' else 'edit' end))::boolean,false))) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  if not exists(select 1 from public.products where id=r.product_id) then
    raise exception 'catalog:unavailable' using errcode='22023';
  end if;
  return jsonb_build_object('id',r.product_id,'revision',r.result_revision,'createdItems',0,'replayed',true);
end $$;

create function public.catalog_save_product(
  p_admin_id uuid,p_request_id uuid,p_operation text,p_product_id uuid,
  p_expected_revision bigint,p_payload jsonb,p_variants jsonb
) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare
  a public.admin_users%rowtype; previous public.products%rowtype; n public.products%rowtype;
  receipt catalog_private.product_save_receipts%rowtype;
  revision bigint; fingerprint bytea; mode text; item jsonb; field text; value jsonb;
  inventory public.commerce_warehouse_inventory%rowtype; next_quantity integer; audit uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  if p_operation is null or p_operation not in ('create','update') or p_request_id is null
    or (p_operation='create' and (p_product_id is not null or p_expected_revision is not null))
    or (p_operation='update' and (p_product_id is null or p_expected_revision is null
      or p_expected_revision not between 0 and 9007199254740991)) then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  -- Revocation and ERP switching cannot commit midway through this command.
  select * into a from public.admin_users where id=p_admin_id for share;
  if not found or not a.is_active or not (a.role='owner' or
    (coalesce((a.permissions->>'products.view')::boolean,false) and
    coalesce((a.permissions->>('products.'||case p_operation when 'create' then 'add' else 'edit' end))::boolean,false))) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  select erp_mode into mode from public.site_settings where key='default' for share;
  mode:=coalesce(mode,'built_in');
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>200000
    or p_variants is null or jsonb_typeof(p_variants)<>'array' then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('seo_title', 'seo_description', 'seo_image_url', 'title', 'slug', 'description', 'long_description', 'price', 'old_price', 'image_url', 'category_id', 'brand_id', 'default_supplier_id', 'primary_warehouse_id', 'sku', 'color_name', 'color_hex', 'is_serialized', 'is_published', 'warranty_status', 'warranty_duration_value', 'warranty_duration_unit', 'selling_mode', 'expected_availability_date', 'availability_message', 'preorder_active', 'preorder_starts_at', 'preorder_ends_at', 'preorder_payment_mode', 'preorder_deposit_percent', 'preorder_total_limit', 'preorder_customer_limit', 'stock_quantity')) then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  fingerprint:=sha256(convert_to(jsonb_build_object('operation',p_operation,'product_id',p_product_id,
    'expected_revision',p_expected_revision,'payload',p_payload,'variants',p_variants)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('catalog:save:'||p_request_id::text,0));
  select * into receipt from catalog_private.product_save_receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id is distinct from p_admin_id or receipt.operation<>p_operation
      or receipt.payload_hash<>fingerprint then
      raise exception 'catalog:request_reused' using errcode='22023';
    end if;
    if not exists(select 1 from public.products where id=receipt.product_id) then
      raise exception 'catalog:unavailable' using errcode='22023';
    end if;
    return jsonb_build_object('id',receipt.product_id,'revision',receipt.result_revision,
      'createdItems',0,'replayed',true);
  end if;
  -- Validate normalized server inputs again at the service-only database boundary.
  if jsonb_typeof(p_payload->'title') is distinct from 'string'
    or length(btrim(p_payload->>'title')) not between 1 and 500
    or jsonb_typeof(p_payload->'slug') is distinct from 'string'
    or length(p_payload->>'slug') not between 1 and 200
    or (p_payload->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or jsonb_typeof(p_payload->'price') is distinct from 'number'
    or jsonb_typeof(p_payload->'is_serialized') is distinct from 'boolean' then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  for field,value in select k,v from jsonb_each(p_payload) x(k,v) loop
    if value='null'::jsonb then continue;end if;
    if field in ('price','old_price') and (jsonb_typeof(value)<>'number'
      or (value::text)::numeric not between 0 and 9999999999.99
      or (value::text)::numeric<>round((value::text)::numeric,2)) then
      raise exception 'catalog:invalid' using errcode='22023';
    elsif field='stock_quantity' and (jsonb_typeof(value)<>'number'
      or value::text !~ '^[0-9]+$' or (value::text)::numeric>2147483647) then
      raise exception 'catalog:invalid' using errcode='22023';
    elsif field in ('is_published','preorder_active') and jsonb_typeof(value)<>'boolean' then
      raise exception 'catalog:invalid' using errcode='22023';
    elsif field in ('category_id','brand_id','default_supplier_id','primary_warehouse_id')
      and (jsonb_typeof(value)<>'string' or (value#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'catalog:invalid' using errcode='22023';
    elsif field in ('title','description','long_description','sku','image_url','color_name','color_hex',
      'seo_title','seo_description','seo_image_url','availability_message') then
      if jsonb_typeof(value)<>'string' or length(value#>>'{}')>(case field
        when 'title' then 500 when 'description' then 10000 when 'sku' then 120
        when 'image_url' then 2048 when 'color_name' then 120 when 'color_hex' then 7
        when 'seo_title' then 1000 when 'seo_description' then 10000
        when 'seo_image_url' then 2048 when 'availability_message' then 500 else 100000 end)
        or (field='sku' and (value#>>'{}') ~ '[[:cntrl:]]') then
        raise exception 'catalog:invalid' using errcode='22023';
      end if;
    end if;
  end loop;
  if p_operation='update' then
    select * into previous from public.products where id=p_product_id for update;
    if not found then raise exception 'catalog:not_found' using errcode='P0002';end if;
    select r.revision into revision from catalog_private.product_revisions r
      where r.product_id=p_product_id for update;
    if revision is distinct from p_expected_revision then
      raise exception 'catalog:conflict' using errcode='40001';
    end if;
    n:=jsonb_populate_record(previous,p_payload);
    if n.is_serialized is distinct from previous.is_serialized then
      raise exception 'catalog:tracking' using errcode='22023';
    end if;
    if mode='daftra' and (n.primary_warehouse_id is distinct from previous.primary_warehouse_id
      or n.default_supplier_id is distinct from previous.default_supplier_id
      or n.stock_quantity is distinct from previous.stock_quantity) then
      raise exception 'catalog:erp' using errcode='22023';
    end if;
  else
    if (p_payload->>'is_serialized')::boolean is not true then
      raise exception 'catalog:tracking' using errcode='22023';
    end if;
    n:=jsonb_populate_record(null::public.products,p_payload);
    n.is_serialized:=true;n.stock_quantity:=0;n.warranty_status:=coalesce(n.warranty_status,'unknown');
  end if;
  if n.is_serialized then
    if p_payload ? 'stock_quantity' or n.primary_warehouse_id is null
      or jsonb_array_length(p_variants) not between 1 and 100 then
      raise exception 'catalog:invalid' using errcode='22023';
    end if;
    if p_operation='update' and previous.primary_warehouse_id is distinct from n.primary_warehouse_id
      and (previous.stock_quantity<>0 or exists(select 1 from public.commerce_serialized_units where product_id=p_product_id)) then
      raise exception 'catalog:stock' using errcode='22023';
    end if;
    for item in select * from jsonb_array_elements(p_variants) loop
      if jsonb_typeof(item)<>'object' or item ? 'quantity' or item ? 'stock_quantity'
        or jsonb_typeof(item->'name') is distinct from 'string' or length(btrim(item->>'name')) not between 1 and 120
        or jsonb_typeof(item->'code') is distinct from 'string' or length(item->>'code') not between 1 and 80
        or (item->>'code') !~ '^[A-Z0-9_-]+$'
        or (item->'sku' is not null and item->'sku'<>'null'::jsonb and
          (jsonb_typeof(item->'sku')<>'string' or length(item->>'sku')>120 or (item->>'sku') ~ '[[:cntrl:]]'))
        or (item->'color_name' is not null and item->'color_name'<>'null'::jsonb and
          (jsonb_typeof(item->'color_name')<>'string' or length(item->>'color_name')>120)) then
        raise exception 'catalog:invalid' using errcode='22023';
      end if;
    end loop;
  elsif jsonb_array_length(p_variants)<>0 or n.stock_quantity is null then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  if n.default_supplier_id is not null then
    perform 1 from public.commerce_crm_accounts where id=n.default_supplier_id and account_type='supplier' and is_active for share;
    if not found then raise exception 'catalog:reference' using errcode='22023';end if;
  end if;
  if n.primary_warehouse_id is not null then
    perform 1 from public.commerce_warehouses where id=n.primary_warehouse_id and is_active for share;
    if not found then raise exception 'catalog:reference' using errcode='22023';end if;
  end if;
  if p_operation='create' then
    insert into public.products (
    seo_title,
    seo_description,
    seo_image_url,
    title,
    slug,
    description,
    long_description,
    price,
    old_price,
    image_url,
    category_id,
    brand_id,
    default_supplier_id,
    primary_warehouse_id,
    sku,
    color_name,
    color_hex,
    is_serialized,
    is_published,
    warranty_status,
    warranty_duration_value,
    warranty_duration_unit,
    selling_mode,
    expected_availability_date,
    availability_message,
    preorder_active,
    preorder_starts_at,
    preorder_ends_at,
    preorder_payment_mode,
    preorder_deposit_percent,
    preorder_total_limit,
    preorder_customer_limit, stock_quantity, cost_price
    ) values (
    n.seo_title,
    n.seo_description,
    n.seo_image_url,
    n.title,
    n.slug,
    n.description,
    n.long_description,
    n.price,
    n.old_price,
    n.image_url,
    n.category_id,
    n.brand_id,
    n.default_supplier_id,
    n.primary_warehouse_id,
    n.sku,
    n.color_name,
    n.color_hex,
    n.is_serialized,
    n.is_published,
    n.warranty_status,
    n.warranty_duration_value,
    n.warranty_duration_unit,
    n.selling_mode,
    n.expected_availability_date,
    n.availability_message,
    n.preorder_active,
    n.preorder_starts_at,
    n.preorder_ends_at,
    n.preorder_payment_mode,
    n.preorder_deposit_percent,
    n.preorder_total_limit,
    n.preorder_customer_limit, 0, 0
    ) returning * into n;
    p_product_id:=n.id;
  else
    update public.products set
    seo_title = n.seo_title,
    seo_description = n.seo_description,
    seo_image_url = n.seo_image_url,
    title = n.title,
    slug = n.slug,
    description = n.description,
    long_description = n.long_description,
    price = n.price,
    old_price = n.old_price,
    image_url = n.image_url,
    category_id = n.category_id,
    brand_id = n.brand_id,
    default_supplier_id = n.default_supplier_id,
    primary_warehouse_id = n.primary_warehouse_id,
    sku = n.sku,
    color_name = n.color_name,
    color_hex = n.color_hex,
    is_serialized = n.is_serialized,
    is_published = n.is_published,
    warranty_status = n.warranty_status,
    warranty_duration_value = n.warranty_duration_value,
    warranty_duration_unit = n.warranty_duration_unit,
    selling_mode = n.selling_mode,
    expected_availability_date = n.expected_availability_date,
    availability_message = n.availability_message,
    preorder_active = n.preorder_active,
    preorder_starts_at = n.preorder_starts_at,
    preorder_ends_at = n.preorder_ends_at,
    preorder_payment_mode = n.preorder_payment_mode,
    preorder_deposit_percent = n.preorder_deposit_percent,
    preorder_total_limit = n.preorder_total_limit,
    preorder_customer_limit = n.preorder_customer_limit,
    stock_quantity = n.stock_quantity
    where id=p_product_id;
  end if;
  if n.is_serialized then
    begin
      perform public.commerce_define_product_variants(p_product_id,p_variants,p_admin_id);
    exception when raise_exception then
      raise exception 'catalog:variants' using errcode='22023';
    end;
  elsif mode='built_in' then
    -- Preserve the legacy primary-warehouse delta rules, now under the product lock.
    if previous.primary_warehouse_id is not null and previous.primary_warehouse_id is distinct from n.primary_warehouse_id
      and (previous.stock_quantity>0 or n.stock_quantity>0) then
      raise exception 'catalog:stock' using errcode='22023';
    end if;
    if n.primary_warehouse_id is not null then
      select * into inventory from public.commerce_warehouse_inventory
        where warehouse_id=n.primary_warehouse_id and product_id=p_product_id for update;
      if not found then
        if n.stock_quantity>0 then
          insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity,average_cost,updated_at)
            values(n.primary_warehouse_id,p_product_id,n.stock_quantity,previous.cost_price,clock_timestamp());
        end if;
      else
        next_quantity:=case when previous.primary_warehouse_id=n.primary_warehouse_id then
          inventory.quantity+n.stock_quantity-previous.stock_quantity else n.stock_quantity end;
        if next_quantity<0 then raise exception 'catalog:stock' using errcode='22023';end if;
        update public.commerce_warehouse_inventory set quantity=next_quantity,
          updated_at=clock_timestamp() where id=inventory.id;
      end if;
    end if;
  end if;
  select r.revision into strict revision from catalog_private.product_revisions r where r.product_id=p_product_id;
  insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,
      case p_operation when 'create' then 'products.create' else 'products.update' end,
      left(case p_operation when 'create' then 'Added product ' else 'Updated product ' end||n.title||'.',220),
      jsonb_build_object('product_id',p_product_id,'product_title',n.title,'product_slug',n.slug,
        'request_id',p_request_id,'revision',revision,
        'warranty_before',case when p_operation='update' then jsonb_build_object('warranty_status',previous.warranty_status,
          'warranty_duration_value',previous.warranty_duration_value,'warranty_duration_unit',previous.warranty_duration_unit) else null end,
        'warranty_after',jsonb_build_object('warranty_status',n.warranty_status,
          'warranty_duration_value',n.warranty_duration_value,'warranty_duration_unit',n.warranty_duration_unit)))
    returning id into audit;
  insert into catalog_private.product_save_receipts(request_id,actor_id,operation,product_id,expected_revision,payload_hash,result_revision,audit_id)
    values(p_request_id,p_admin_id,p_operation,p_product_id,p_expected_revision,fingerprint,revision,audit);
  return jsonb_build_object('id',p_product_id,'revision',revision,'createdItems',0,'replayed',false);
end $$;

revoke all on function catalog_private.track_product_revision(),catalog_private.track_variant_revision()
  from public,anon,authenticated,service_role;
revoke all on function public.catalog_product_edit_snapshot(uuid,uuid),public.catalog_product_save_status(uuid,uuid),
  public.catalog_save_product(uuid,uuid,text,uuid,bigint,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.catalog_product_edit_snapshot(uuid,uuid),public.catalog_product_save_status(uuid,uuid),
  public.catalog_save_product(uuid,uuid,text,uuid,bigint,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
