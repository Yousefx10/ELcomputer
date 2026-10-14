-- 77: bounded, read-only merchandising snapshots. No catalog/import writes.
begin;
create function catalog_private.transfer_product(p public.products) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if octet_length(coalesce(p.title,''))>2000 or octet_length(coalesce(p.description,''))>40000
  or octet_length(coalesce(p.long_description,''))>400000 or octet_length(coalesce(p.seo_description,''))>40000
  or octet_length(coalesce(p.seo_title,''))>4000
  or octet_length(coalesce(p.slug,''))>800 or octet_length(coalesce(p.sku,''))>480
  or octet_length(coalesce(p.image_url,''))>8192 or octet_length(coalesce(p.seo_image_url,''))>8192
  or octet_length(coalesce(p.color_name,''))>480 or octet_length(coalesce(p.color_hex,''))>28
  or octet_length(coalesce(p.availability_message,''))>2000
  or octet_length(coalesce(p.price::text,''))>32 or octet_length(coalesce(p.old_price::text,''))>32
  or octet_length(coalesce(p.preorder_deposit_percent::text,''))>32 then raise exception 'transfer:limit' using errcode='22023';end if;
 result:=jsonb_build_object('product_key',p.id,'product_id',p.id,'tracking_mode',case when p.is_serialized then 'serialized' else 'aggregate' end,
'title',p.title,
'slug',p.slug,
'sku',p.sku,
'description',p.description,
'long_description',p.long_description,
'category_id',p.category_id,
'brand_id',p.brand_id,
'price',p.price::text,
'old_price',p.old_price::text,
'selling_mode',p.selling_mode,
'is_published',p.is_published,
'image_url',p.image_url,
'color_name',p.color_name,
'color_hex',p.color_hex,
'seo_title',p.seo_title,
'seo_description',p.seo_description,
'seo_image_url',p.seo_image_url,
'warranty_status',p.warranty_status,
'warranty_duration_value',p.warranty_duration_value,
'warranty_duration_unit',p.warranty_duration_unit,
'expected_availability_date',p.expected_availability_date,
'availability_message',p.availability_message,
'preorder_active',p.preorder_active,
'preorder_starts_at',p.preorder_starts_at,
'preorder_ends_at',p.preorder_ends_at,
'preorder_payment_mode',p.preorder_payment_mode,
'preorder_deposit_percent',p.preorder_deposit_percent::text,
'preorder_total_limit',p.preorder_total_limit,
'preorder_customer_limit',p.preorder_customer_limit);
 if octet_length(result::text)>600000 then raise exception 'transfer:limit' using errcode='22023';end if;
 return result;
end $$;
revoke all on function catalog_private.transfer_product(public.products) from public,anon,authenticated,service_role;

create function public.catalog_transfer_snapshot(p_admin_id uuid,p_purpose text,p_scope text,p_ids jsonb,p_filters jsonb,p_match jsonb,p_media jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 a public.admin_users%rowtype; input_ids uuid[]:=array[]::uuid[]; ids uuid[]:=array[]::uuid[]; page jsonb; item jsonb; row jsonb; bucket text; arr jsonb;
 result jsonb:=jsonb_build_object('products','[]'::jsonb,'variants','[]'::jsonb,'specifications','[]'::jsonb,'images','[]'::jsonb,
  'categories','[]'::jsonb,'brands','[]'::jsonb,'definitions','[]'::jsonb,'product_collisions','[]'::jsonb,'variant_collisions','[]'::jsonb);
 total integer:=0; bytes integer:=0; n integer; revision bigint;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'transfer:permission' using errcode='42501';end if;
 select * into a from public.admin_users where id=p_admin_id and is_active;
 if not found or not (a.role='owner' or coalesce((a.permissions->>'products.view')::boolean,false))
  or (p_purpose='preview' and not (a.role='owner' or coalesce((a.permissions->>'products.edit')::boolean,false) or coalesce((a.permissions->>'products.add')::boolean,false))) then
  raise exception 'transfer:permission' using errcode='42501';end if;
 if p_ids is null or jsonb_typeof(p_ids)<>'array' or jsonb_array_length(p_ids)>250 then raise exception 'transfer:invalid' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_ids) loop
  if jsonb_typeof(item)<>'string' or (item#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'transfer:invalid' using errcode='22023';end if;input_ids:=array_append(input_ids,(item#>>'{}')::uuid);
 end loop;
 if p_purpose is null or p_purpose not in ('export','template','preview') or p_scope is null
  or p_filters is null or jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>2000
  or p_match is null or jsonb_typeof(p_match)<>'object' or octet_length(p_match::text)>500000
  or p_media is null or jsonb_typeof(p_media)<>'object' or octet_length(p_media::text)>4194304 then raise exception 'transfer:invalid' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(p_match) k where k not in ('ids','slugs','product_skus','variant_skus','variant_ids','spec_ids','image_ids')) then raise exception 'transfer:invalid' using errcode='22023';end if;
 for bucket,arr in select k,v from jsonb_each(p_match) x(k,v) loop
  if jsonb_typeof(arr)<>'array' or jsonb_array_length(arr)>2500 then raise exception 'transfer:limit' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(arr) loop
   if jsonb_typeof(item)<>'string' or length(item#>>'{}')>200 then raise exception 'transfer:invalid' using errcode='22023';end if;
   if bucket in ('ids','variant_ids','spec_ids','image_ids') and (item#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'transfer:invalid' using errcode='22023';end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_filters) k where k not in ('q','status','category','brand','mode','stock','sort')) or (p_purpose<>'preview' and (p_match<>'{}'::jsonb or p_media<>'{}'::jsonb)) or (p_purpose='preview' and p_filters<>'{}'::jsonb) then raise exception 'transfer:invalid' using errcode='22023';end if;
 if p_purpose='template' then
  if p_scope<>'none' or coalesce(cardinality(input_ids),0)<>0 or p_match<>'{}'::jsonb then raise exception 'transfer:invalid' using errcode='22023';end if;
 elsif p_purpose='export' then
  if p_scope='selected' then
   if cardinality(input_ids) is null or cardinality(input_ids) not between 1 and 25 or exists(select 1 from unnest(input_ids) id where id is null)
    or (select count(distinct id) from unnest(input_ids) id)<>cardinality(input_ids) then raise exception 'transfer:invalid' using errcode='22023';end if;
   ids:=input_ids;if(select count(*) from public.products where id=any(ids))<>cardinality(ids) then raise exception 'transfer:missing' using errcode='22023';end if;
  elsif p_scope='filtered' then
   if coalesce(cardinality(input_ids),0)<>0 then raise exception 'transfer:invalid' using errcode='22023';end if;
   for n in 1..10 loop
    page:=public.catalog_product_list(p_admin_id,coalesce(p_filters->>'q',''),coalesce(p_filters->>'status','all'),nullif(p_filters->>'category','')::uuid,nullif(p_filters->>'brand','')::uuid,
     coalesce(p_filters->>'mode','all'),coalesce(p_filters->>'stock','all'),coalesce(p_filters->>'sort','newest'),n);
    if (page->>'total')::integer>250 then raise exception 'transfer:limit' using errcode='22023';end if;
    for item in select value from jsonb_array_elements(page->'items') loop ids:=array_append(ids,(item->>'id')::uuid);end loop;
    exit when n*25>=(page->>'total')::integer;
   end loop;
  else raise exception 'transfer:invalid' using errcode='22023';end if;
 elsif p_scope='matching' and coalesce(cardinality(input_ids),0)=0 then
  select coalesce(array_agg(p.id),array[]::uuid[]) into ids from public.products p where p.id in (select v::uuid from jsonb_array_elements_text(coalesce(p_match->'ids','[]')) x(v));
 else raise exception 'transfer:invalid' using errcode='22023';end if;
 if cardinality(ids)>250 then raise exception 'transfer:limit' using errcode='22023';end if;
 for row in select catalog_private.transfer_product(p)||jsonb_build_object('expected_revision',r.revision,
   '_operational_ready',(p.default_supplier_id is null or exists(select 1 from public.commerce_crm_accounts s where s.id=p.default_supplier_id and s.account_type='supplier' and s.is_active))
    and (not p.is_serialized and p.primary_warehouse_id is null or exists(select 1 from public.commerce_warehouses w where w.id=p.primary_warehouse_id and w.is_active))
    and (p.is_serialized or p.stock_quantity is not null and p.stock_quantity>=0)) from public.products p left join catalog_private.product_revisions r on r.product_id=p.id where p.id=any(ids) order by p.id loop
  if row->>'expected_revision' is null then raise exception 'transfer:revision' using errcode='22023';end if;
  bytes:=bytes+octet_length(row::text);if bytes>8388608 then raise exception 'transfer:limit' using errcode='22023';end if;
  result:=jsonb_set(result,'{products}',result->'products'||jsonb_build_array(row));
 end loop;
 -- Reject oversized values and collections before constructing their JSON.
 if (select count(*) from public.product_variants where product_id=any(ids))
  +(select count(*) from public.product_specifications where product_id=any(ids))
  +(select count(*) from public.product_images where product_id=any(ids))>2500
  or exists(select 1 from public.product_variants where product_id=any(ids) and
   (octet_length(coalesce(name,''))>480 or octet_length(coalesce(code,''))>320 or octet_length(coalesce(sku,''))>480 or octet_length(coalesce(color_name,''))>480))
  or exists(select 1 from public.product_specifications where product_id=any(ids) and
   (octet_length(coalesce(value,''))>400000 or octet_length(coalesce(label,''))>800))
  or exists(select 1 from public.product_images where product_id=any(ids) and
   (octet_length(coalesce(image_url,''))>8192 or octet_length(coalesce(alt_text,''))>4000)) then raise exception 'transfer:limit' using errcode='22023';end if;
 for row in
  select jsonb_build_object('id',v.id,'product_key',v.product_id,'entity_key',v.id,'name',v.name,'code',v.code,'sku',v.sku,'color_name',v.color_name,'color_hex',v.color_hex,'is_active',v.is_active,'price',v.price::text,
   '_gallery_reference',exists(select 1 from public.product_images i where i.variant_id=v.id)) from public.product_variants v where v.product_id=any(ids) order by v.product_id,v.id
 loop
  total:=total+1;bytes:=bytes+octet_length(row::text);if total>2500 or bytes>8388608 or octet_length(row::text)>20000 then raise exception 'transfer:limit' using errcode='22023';end if;
  row:=row||jsonb_build_object('expected_hash',encode(sha256(convert_to((row-'_gallery_reference')::text,'UTF8')),'hex'));
  result:=jsonb_set(result,'{variants}',result->'variants'||jsonb_build_array(row));
 end loop;
 for item in select to_jsonb(s) from public.product_specifications s where product_id=any(ids) order by product_id,id loop
  if octet_length(item->>'value')>400000 then raise exception 'transfer:limit' using errcode='22023';end if;
  row:=jsonb_build_object('id',item->'id','product_key',item->'product_id','entity_key',item->'id','definition_id',item->'definition_id','label',item->'label','value',item->'value','sort_order',item->'sort_order','is_highlight',item->'is_highlight');
  total:=total+1;bytes:=bytes+octet_length(row::text);if total>2500 or bytes>8388608 then raise exception 'transfer:limit' using errcode='22023';end if;
  row:=row||jsonb_build_object('expected_hash',encode(sha256(convert_to(row::text,'UTF8')),'hex'));result:=jsonb_set(result,'{specifications}',result->'specifications'||jsonb_build_array(row));
 end loop;
 for row in select jsonb_build_object('id',i.id,'product_key',i.product_id,'entity_key',i.id,'variant_key',i.variant_id,'image_url',i.image_url,'alt_text',i.alt_text,'sort_order',i.sort_order) from public.product_images i where product_id=any(ids) order by product_id,id loop
  total:=total+1;bytes:=bytes+octet_length(row::text);if total>2500 or bytes>8388608 or octet_length(row::text)>20000 then raise exception 'transfer:limit' using errcode='22023';end if;
  row:=row||jsonb_build_object('expected_hash',encode(sha256(convert_to(row::text,'UTF8')),'hex'));result:=jsonb_set(result,'{images}',result->'images'||jsonb_build_array(row));
 end loop;
 if (select count(*) from public.categories)>1000 or (select count(*) from public.brands)>1000
  or (select count(*) from public.specification_definitions)>1000
  or exists(select 1 from public.categories where octet_length(coalesce(name,''))>4000 or octet_length(coalesce(name_ar,''))>4000 or octet_length(coalesce(slug,''))>800)
  or exists(select 1 from public.brands where octet_length(coalesce(name,''))>4000 or octet_length(coalesce(slug,''))>800)
  or exists(select 1 from public.specification_definitions where octet_length(coalesce(name,''))>4000 or octet_length(coalesce(key,''))>800) then raise exception 'transfer:limit' using errcode='22023';end if;
 for bucket in select unnest(array['categories','brands','definitions']) loop
  n:=0;
  for row in select doc from (
   select jsonb_build_object('id',id,'slug',slug,'name',name,'name_ar',name_ar) doc from public.categories where bucket='categories'
   union all select jsonb_build_object('id',id,'slug',slug,'name',name) from public.brands where bucket='brands'
   union all select jsonb_build_object('id',id,'key',s.key,'name',name,'is_active',is_active) from public.specification_definitions s where bucket='definitions'
  ) x order by doc->>'id' limit 1001 loop
   n:=n+1;bytes:=bytes+octet_length(row::text);if n>1000 or bytes>8388608 or octet_length(row::text)>20000 then raise exception 'transfer:limit' using errcode='22023';end if;
   result:=jsonb_set(result,array[bucket],result->bucket||jsonb_build_array(row));
  end loop;
 end loop;
 if p_purpose='preview' then
  for row in select jsonb_build_object('id',p.id,'slug',p.slug,'sku',p.sku) from public.products p where p.slug in (select v from jsonb_array_elements_text(coalesce(p_match->'slugs','[]')) x(v)) or lower(p.sku) in (select lower(v) from jsonb_array_elements_text(coalesce(p_match->'product_skus','[]')) x(v)) limit 251 loop
   result:=jsonb_set(result,'{product_collisions}',result->'product_collisions'||jsonb_build_array(row));end loop;
  if jsonb_array_length(result->'product_collisions')>250 then raise exception 'transfer:limit' using errcode='22023';end if;
  for row in select jsonb_build_object('id',v.id,'product_key',v.product_id,'sku',v.sku) from public.product_variants v where v.is_active and lower(v.sku) in (select lower(s) from jsonb_array_elements_text(coalesce(p_match->'variant_skus','[]')) x(s)) limit 2501 loop
   result:=jsonb_set(result,'{variant_collisions}',result->'variant_collisions'||jsonb_build_array(row));end loop;
  if jsonb_array_length(result->'variant_collisions')>2500 then raise exception 'transfer:limit' using errcode='22023';end if;
 end if;
 -- Reuse the media guard's canonical extraction for URLs in copy/specifications
 -- as well as explicit image columns. This reads path metadata only.
 if p_purpose='preview' then
  result:=result||jsonb_build_object('media_fields','[]'::jsonb);n:=0;
  for row in
   select distinct jsonb_build_object('table',t.k,'index',r.n-1,'field',f.k,'path',lower(m.path),'source_path',m.path)
   from jsonb_each(p_media) t(k,v), lateral jsonb_array_elements(t.v) with ordinality r(v,n),
    lateral jsonb_each(r.v) f(k,v),
    lateral regexp_matches(catalog_private.media_decode(f.v#>>'{}'),'(/uploads/[^[:space:]"''<>()[\]{}\\]+)','g') matches,
    lateral (select catalog_private.media_canonical(split_part(split_part(matches[1],'?',1),'#',1)) path) m
   where m.path is not null and octet_length(m.path)<=512 limit 1001
  loop n:=n+1;if n>1000 then raise exception 'transfer:limit' using errcode='22023';end if;
   result:=jsonb_set(result,'{media_fields}',result->'media_fields'||jsonb_build_array(row));
  end loop;
 end if;
 result:=result||jsonb_build_object('can_create',a.role='owner' or coalesce((a.permissions->>'products.add')::boolean,false),
  'can_update',a.role='owner' or coalesce((a.permissions->>'products.edit')::boolean,false),
  'has_active_warehouse',exists(select 1 from public.commerce_warehouses where is_active),
  'unavailable_media',coalesce((select jsonb_agg(m.path) from catalog_private.media_paths m where m.state<>'active' and m.path in (select catalog_private.media_references(p_media))),'[]'::jsonb));
 if octet_length(result::text)>8388608 then raise exception 'transfer:limit' using errcode='22023';end if;
 return result;
end $$;
revoke all on function public.catalog_transfer_snapshot(uuid,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.catalog_transfer_snapshot(uuid,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
