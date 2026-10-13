-- 76: sparse product commands; no inventory, media or variant writes.
begin;

create table catalog_private.product_bulk_receipts (
  request_id uuid primary key,
  actor_id uuid not null,
  payload_hash bytea not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table catalog_private.product_bulk_receipts enable row level security;
revoke all on catalog_private.product_bulk_receipts from public,anon,authenticated,service_role;
-- No foreign keys: retain acknowledged results after catalog/staff removal.

create function catalog_private.require_product_bulk_editor(p_admin_id uuid)
returns public.admin_users language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'catalog:permission' using errcode='42501'; end if;
  select * into a from public.admin_users where id=p_admin_id for share;
  if not found or not a.is_active or not (a.role='owner' or
    (coalesce((a.permissions->>'products.view')::boolean,false) and coalesce((a.permissions->>'products.edit')::boolean,false))) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  return a;
end $$;

-- Validate existing definitions without normalizing or rewriting a full form.
-- Optional copy, images, category/brand and stock are not publication prerequisites.
create function catalog_private.assert_product_publishable(p public.products)
returns void language plpgsql security definer set search_path='' as $$
declare v public.product_variants%rowtype; count_options integer:=0;
begin
  if p.title is null or length(btrim(p.title)) not between 1 and 500
    or p.slug is null or length(p.slug) not between 1 and 200 or p.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p.price is null or p.price::text in ('NaN','Infinity','-Infinity') or p.price not between 0 and 9999999999.99 or p.price<>round(p.price,2)
    or (p.old_price is not null and (p.old_price::text in ('NaN','Infinity','-Infinity') or p.old_price not between 0 and 9999999999.99 or p.old_price<>round(p.old_price,2)))
    or (p.sku is not null and (length(p.sku)>120 or p.sku ~ '[[:cntrl:]]'))
    or p.is_serialized is null or p.selling_mode is null or p.selling_mode not in ('normal','coming_soon','preorder')
    or (p.selling_mode='preorder' and p.price<=0)
    or p.preorder_payment_mode is null or p.preorder_payment_mode not in ('full','deposit')
    or (p.preorder_payment_mode='deposit' and (p.preorder_deposit_percent is null or p.preorder_deposit_percent<=0 or p.preorder_deposit_percent>=100))
    or (p.preorder_starts_at is not null and p.preorder_ends_at is not null and p.preorder_ends_at<=p.preorder_starts_at)
    or (p.preorder_total_limit is not null and p.preorder_total_limit<=0)
    or (p.preorder_customer_limit is not null and p.preorder_customer_limit<=0)
    or (not p.is_serialized and (p.stock_quantity is null or p.stock_quantity<0)) then
    raise exception 'catalog:incomplete';
  end if;
  if p.default_supplier_id is not null then
    perform 1 from public.commerce_crm_accounts where id=p.default_supplier_id and account_type='supplier' and is_active for share;
    if not found then raise exception 'catalog:incomplete'; end if;
  end if;
  if p.is_serialized or p.primary_warehouse_id is not null then
    perform 1 from public.commerce_warehouses where id=p.primary_warehouse_id and is_active for share;
    if not found then raise exception 'catalog:incomplete'; end if;
  end if;
  for v in select * from public.product_variants where product_id=p.id and is_active order by id for share loop
    count_options:=count_options+1;
    if v.name is null or length(btrim(v.name)) not between 1 and 120 or v.code is null
      or length(v.code) not between 1 and 80 or v.code !~ '^[A-Z0-9_-]+$'
      or (v.sku is not null and (length(v.sku)>120 or v.sku ~ '[[:cntrl:]]'))
      or (v.color_name is not null and length(v.color_name)>120) then raise exception 'catalog:incomplete'; end if;
  end loop;
  if count_options<1 or (p.is_serialized and count_options>100) then raise exception 'catalog:incomplete'; end if;
end $$;

create function public.catalog_bulk_products(p_admin_id uuid,p_request_id uuid,p_operation text,p_reference_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare
  a public.admin_users%rowtype; p public.products%rowtype; receipt catalog_private.product_bulk_receipts%rowtype;
  canonical jsonb; fingerprint bytea; item jsonb; revision bigint; desired jsonb; before_value jsonb;
  results jsonb:='[]'; result jsonb; state text; reason text; message text; changed_field text; reference_available boolean:=true;
begin
  a:=catalog_private.require_product_bulk_editor(p_admin_id);
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'catalog:invalid' using errcode='22023'; end if;
  if p_request_id is null or p_operation is null or p_operation not in ('publish','draft','category','brand')
    or (p_operation in ('category','brand') and p_reference_id is null)
    or (p_operation in ('publish','draft') and p_reference_id is not null)
    or p_items is null or jsonb_typeof(p_items)<>'array' or octet_length(p_items::text)>12000 then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 25 then raise exception 'catalog:invalid' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item)<>'object' then raise exception 'catalog:invalid' using errcode='22023'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('id','expected_revision'))
      or jsonb_typeof(item->'id') is distinct from 'string' or (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item->'expected_revision') is distinct from 'number' or (item->>'expected_revision') !~ '^[0-9]+$'
      or (item->>'expected_revision')::numeric>9007199254740991 then raise exception 'catalog:invalid' using errcode='22023'; end if;
  end loop;
  select jsonb_agg(jsonb_build_object('id',(x->>'id')::uuid,'expected_revision',(x->>'expected_revision')::bigint) order by (x->>'id')::uuid)
    into canonical from jsonb_array_elements(p_items) x;
  if (select count(distinct x->>'id') from jsonb_array_elements(canonical) x)<>jsonb_array_length(canonical) then
    raise exception 'catalog:invalid' using errcode='22023';
  end if;
  fingerprint:=sha256(convert_to(jsonb_build_object('operation',p_operation,'reference_id',p_reference_id,'items',canonical)::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('catalog:bulk:'||p_request_id::text,0));
  select * into receipt from catalog_private.product_bulk_receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id is distinct from p_admin_id or receipt.payload_hash<>fingerprint then raise exception 'catalog:request_reused' using errcode='22023'; end if;
    return receipt.result||jsonb_build_object('replayed',true);
  end if;
  if p_operation='category' then
    perform 1 from public.categories where id=p_reference_id for share;
    reference_available:=found;
  elsif p_operation='brand' then
    perform 1 from public.brands where id=p_reference_id for share;
    reference_available:=found;
  end if;
  changed_field:=case p_operation when 'category' then 'category_id' when 'brand' then 'brand_id' else 'is_published' end;
  desired:=case when p_operation in ('category','brand') then to_jsonb(p_reference_id) else to_jsonb(p_operation='publish') end;
  for item in select value from jsonb_array_elements(canonical) loop
    state:='failed';reason:=null;revision:=null;
    begin -- A failure rolls back only this product and its audit.
      -- Keep missing-reference rejections terminal too: a delayed duplicate must
      -- not apply after the reference is restored.
      if not reference_available then raise exception 'catalog:reference'; end if;
      select * into p from public.products where id=(item->>'id')::uuid for update;
      if not found then raise exception 'catalog:not_found'; end if;
      select r.revision into revision from catalog_private.product_revisions r where r.product_id=p.id for update;
      if revision is distinct from (item->>'expected_revision')::bigint then raise exception 'catalog:conflict'; end if;
      if p_operation='publish' then perform catalog_private.assert_product_publishable(p); end if;
      before_value:=to_jsonb(p)->changed_field;
      if before_value is not distinct from desired then state:='unchanged';
      else
        if p_operation in ('publish','draft') then update public.products set is_published=(p_operation='publish') where id=p.id;
        elsif p_operation='category' then update public.products set category_id=p_reference_id where id=p.id;
        else update public.products set brand_id=p_reference_id where id=p.id; end if;
        select r.revision into revision from catalog_private.product_revisions r where r.product_id=p.id;
        insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
          values(a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,'products.update',left('Updated product '||p.title||'.',220),
            jsonb_build_object('product_id',p.id,'request_id',p_request_id,'bulk_operation',p_operation,'field',changed_field,
              'before',before_value,'after',desired,'revision',revision));
        state:='succeeded';
      end if;
    exception when others then
      get stacked diagnostics message=message_text;
      reason:=case message when 'catalog:conflict' then 'conflict' when 'catalog:not_found' then 'not_found'
        when 'catalog:incomplete' then 'incomplete' when 'catalog:reference' then 'reference' else 'failed' end;
      state:=case when reason='conflict' then 'conflicted' else 'failed' end;
      revision:=null;
    end;
    results:=results||jsonb_build_array(jsonb_build_object('id',item->>'id','status',state,'reason',reason,'revision',revision));
  end loop;
  select jsonb_build_object('request_id',p_request_id,'operation',p_operation,'items',results,'replayed',false,
    'succeeded',count(*) filter(where x->>'status'='succeeded'),'unchanged',count(*) filter(where x->>'status'='unchanged'),
    'conflicted',count(*) filter(where x->>'status'='conflicted'),'failed',count(*) filter(where x->>'status'='failed')) into result
    from jsonb_array_elements(results) x;
  insert into catalog_private.product_bulk_receipts(request_id,actor_id,payload_hash,result) values(p_request_id,p_admin_id,fingerprint,result);
  return result;
end $$;

create function public.catalog_product_bulk_status(p_admin_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare result jsonb;
begin
  perform catalog_private.require_product_bulk_editor(p_admin_id);
  if p_request_id is null or current_setting('transaction_isolation')<>'read committed' then raise exception 'catalog:invalid' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('catalog:bulk:'||p_request_id::text,0));
  select r.result||jsonb_build_object('replayed',true) into result from catalog_private.product_bulk_receipts r where request_id=p_request_id and actor_id=p_admin_id;
  return result;
end $$;

revoke all on function catalog_private.require_product_bulk_editor(uuid),catalog_private.assert_product_publishable(public.products)
  from public,anon,authenticated,service_role;
revoke all on function public.catalog_bulk_products(uuid,uuid,text,uuid,jsonb),public.catalog_product_bulk_status(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.catalog_bulk_products(uuid,uuid,text,uuid,jsonb),public.catalog_product_bulk_status(uuid,uuid) to service_role;

-- Listing revisions below are read in the same snapshot as their product rows.

create or replace function public.catalog_product_list(p_admin_id uuid,p_query text default '',p_status text default 'all',
  p_category uuid default null,p_brand uuid default null,p_mode text default 'all',p_stock text default 'all',
  p_sort text default 'newest',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.admin_users%rowtype; term text; result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'catalog:permission' using errcode='42501'; end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not (a.role='owner' or coalesce((a.permissions->>'products.view')::boolean,false)) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  if p_query is null or length(p_query)>120 or p_query ~ '[[:cntrl:]]' or
    p_status is null or p_status not in ('all','published','drafts') or
    p_mode is null or p_mode not in ('all','normal','coming_soon','preorder') or
    p_stock is null or p_stock not in ('all','in_stock','out_of_stock') or
    p_sort is null or p_sort not in ('newest','oldest','title_asc','title_desc','price_asc','price_desc') or
    p_page is null or p_page<1 or p_page>40000000 then
    raise exception 'catalog:filters' using errcode='22023';
  end if;
  -- Literal substring search. Percent, underscore and backslash are not operators.
  term:='%'||replace(replace(replace(lower(btrim(p_query)),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  with candidates as materialized (
    select p.id from public.products p where
      (p_status='all' or p.is_published=(p_status='published')) and
      (p_category is null or p.category_id=p_category) and (p_brand is null or p.brand_id=p_brand) and
      (p_mode='all' or p.selling_mode=p_mode) and
      (btrim(p_query)='' or p.id in (
        select id from public.products where lower(title) like term or lower(sku) like term
        union select product_id from public.product_variants where lower(code) like term or lower(sku) like term
      ))
  ), matched as materialized (
    select p.id from candidates c join public.products p on p.id=c.id where p_stock='all' or
      (catalog_private.product_list_stock(p::public.products)>0)=(p_stock='in_stock')
  ), totals as (select count(*)::integer total from matched), bounds as (
    select total,least(p_page,greatest(1,ceil(total/25.0)::integer)) page from totals
  ), ordered as (
    select p.* from matched m join public.products p on p.id=m.id order by
      case when p_sort='newest' then p.created_at end desc,
      case when p_sort='oldest' then p.created_at end asc,
      case when p_sort='title_asc' then lower(p.title) end asc,
      case when p_sort='title_desc' then lower(p.title) end desc,
      case when p_sort='price_asc' then p.price end asc,
      case when p_sort='price_desc' then p.price end desc,p.id asc
    limit 25 offset (select (page-1)::bigint*25 from bounds)
  ), rows as (
    select jsonb_build_object('id',p.id,'revision',r.revision,'title',p.title,'sku',p.sku,'image_url',p.image_url,
      'price',p.price,'is_published',p.is_published,'selling_mode',p.selling_mode,'is_serialized',p.is_serialized,
      'category',case when c.id is null then null else jsonb_build_object('id',c.id,'name',c.name,'name_ar',c.name_ar) end,
      'brand',case when b.id is null then null else jsonb_build_object('id',b.id,'name',b.name) end,
      'available_quantity',catalog_private.product_list_stock(p::public.products),
      'option_count',(select count(*) from public.product_variants v where v.product_id=p.id and v.is_active)) item,
      row_number() over (order by
        case when p_sort='newest' then p.created_at end desc,
        case when p_sort='oldest' then p.created_at end asc,
        case when p_sort='title_asc' then lower(p.title) end asc,
        case when p_sort='title_desc' then lower(p.title) end desc,
        case when p_sort='price_asc' then p.price end asc,
        case when p_sort='price_desc' then p.price end desc,p.id asc) position
    from ordered p left join catalog_private.product_revisions r on r.product_id=p.id left join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(item order by position) from rows),'[]'::jsonb),
    'total',total,'page',page,'page_size',25,'catalog_total',(select count(*) from public.products)) into result from bounds;
  return result;
end $$;
revoke all on function public.catalog_product_list(uuid,text,text,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.catalog_product_list(uuid,text,text,uuid,uuid,text,text,text,integer) to service_role;


notify pgrst,'reload schema';
commit;
