begin;
set local lock_timeout = '5s';

-- Trusted PostgreSQL extension. Preserve its existing schema when installed.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
do $$
declare ns text;
begin
  select n.nspname into ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
  execute format('create index catalog_products_title_search_idx on public.products using gin (lower(title) %I.gin_trgm_ops)',ns);
  execute format('create index catalog_products_sku_search_idx on public.products using gin (lower(sku) %I.gin_trgm_ops)',ns);
  execute format('create index catalog_variants_code_search_idx on public.product_variants using gin (lower(code) %I.gin_trgm_ops)',ns);
  execute format('create index catalog_variants_sku_search_idx on public.product_variants using gin (lower(sku) %I.gin_trgm_ops)',ns);
end $$;
create index catalog_products_created_idx on public.products(created_at desc,id);
create index catalog_products_category_idx on public.products(category_id);
create index catalog_products_brand_idx on public.products(brand_id);
create index catalog_units_available_idx on public.commerce_serialized_units(product_id,warehouse_id,variant_id) where status='in_stock';

-- Read-only projection of the existing checkout stock rules, without identifiers,
-- costs, warehouse details or supplier data. Never an inventory writer.
create function catalog_private.product_list_stock(p public.products) returns integer
language plpgsql stable security definer set search_path='' as $$
declare q integer;
begin
  if p.is_serialized then
    if public.get_active_erp_mode()='daftra' then
      select coalesce(sum(public.erp_storefront_stock('product_variant',v.id,0)),0)::integer into q
        from public.product_variants v where v.product_id=p.id and v.is_active;
    else
      select count(*)::integer into q from public.commerce_serialized_units u
        join public.product_variants v on v.id=u.variant_id and v.product_id=p.id and v.is_active
        where u.product_id=p.id and u.warehouse_id=p.primary_warehouse_id and u.status='in_stock';
    end if;
  else
    q:=public.erp_storefront_stock('product',p.id,p.stock_quantity);
  end if;
  return greatest(coalesce(q,0),0);
end $$;
revoke all on function catalog_private.product_list_stock(public.products) from public,anon,authenticated,service_role;

create function public.catalog_product_list(p_admin_id uuid,p_query text default '',p_status text default 'all',
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
    select jsonb_build_object('id',p.id,'title',p.title,'sku',p.sku,'image_url',p.image_url,
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
    from ordered p left join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(item order by position) from rows),'[]'::jsonb),
    'total',total,'page',page,'page_size',25,'catalog_total',(select count(*) from public.products)) into result from bounds;
  return result;
end $$;
revoke all on function public.catalog_product_list(uuid,text,text,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.catalog_product_list(uuid,text,text,uuid,uuid,text,text,text,integer) to service_role;

-- Bounded filter choices. Search remains available beyond the first 100 names.
create function public.catalog_product_filter_options(p_admin_id uuid,p_kind text,p_query text default '',p_selected uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.admin_users%rowtype; term text; result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'catalog:permission' using errcode='42501'; end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not (a.role='owner' or coalesce((a.permissions->>'products.view')::boolean,false)) then
    raise exception 'catalog:permission' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('category','brand') or p_query is null or length(p_query)>120 or p_query ~ '[[:cntrl:]]' then
    raise exception 'catalog:filters' using errcode='22023';
  end if;
  term:='%'||replace(replace(replace(lower(btrim(p_query)),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  with choices as (
    select id,name,name_ar from public.categories where p_kind='category'
    union all select id,name,null::text from public.brands where p_kind='brand'
  ), matches as (select * from choices where lower(name) like term or lower(name_ar) like term), limited as (
    select * from matches order by lower(name),id limit 100
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(l) order by lower(name),id) from limited l),'[]'::jsonb),
    'total',(select count(*) from choices),'matches',(select count(*) from matches),
    'selected',(select to_jsonb(c) from choices c where id=p_selected)) into result;
  return result;
end $$;
revoke all on function public.catalog_product_filter_options(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.catalog_product_filter_options(uuid,text,text,uuid) to service_role;

notify pgrst,'reload schema';
commit;
