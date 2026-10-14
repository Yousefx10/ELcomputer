-- 78: approved, reuploaded catalog imports. No source files or authored values retained.
begin;
set local lock_timeout='5s';
create table catalog_private.import_jobs (
 id uuid primary key, actor_id uuid not null, source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 warehouse_id uuid, retry_of uuid, review_hash text not null, erp_mode text not null,
 needs_add boolean not null, needs_edit boolean not null, publish_count integer not null,
 row_count integer not null check(row_count between 1 and 6000),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default clock_timestamp()+interval '45 minutes',
 approved_at timestamptz, closed_reason text check(closed_reason in ('cancelled','expired')),
 unique nulls not distinct(actor_id,source_hash,warehouse_id,retry_of)
);
create table catalog_private.import_items (
 job_id uuid not null, product_key text not null check(product_key ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'),
 product_id uuid, expected_revision bigint, graph_hash bytea not null, command_hash bytea not null,
 request_id uuid not null default gen_random_uuid(),
 status text not null default 'pending' check(status in ('pending','succeeded','unchanged','conflicted','failed')),
 reason text, result_id uuid, result_revision bigint, finished_at timestamptz,
 primary key(job_id,product_key)
);
-- No external FK changes existing reset/deletion behavior. Receipt tombstones contain
-- only IDs, hashes and outcomes, like migrations 72/76; no file, copy or price data.
alter table catalog_private.import_jobs enable row level security;
alter table catalog_private.import_items enable row level security;
revoke all on catalog_private.import_jobs,catalog_private.import_items from public,anon,authenticated,service_role;

create function catalog_private.import_actor(p_actor uuid,p_add boolean,p_edit boolean) returns void
language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'import:permission' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'import:invalid' using errcode='22023';end if;
 select * into a from public.admin_users where id=p_actor for share;
 if not found or not a.is_active or not(a.role='owner' or coalesce((a.permissions->>'products.view')::boolean,false)
  and (not p_add or coalesce((a.permissions->>'products.add')::boolean,false))
  and (not p_edit or coalesce((a.permissions->>'products.edit')::boolean,false))
  and (coalesce((a.permissions->>'products.add')::boolean,false) or coalesce((a.permissions->>'products.edit')::boolean,false))) then
  raise exception 'import:permission' using errcode='42501';end if;
end $$;

create function catalog_private.import_summary(j catalog_private.import_jobs) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',j.id,'source_hash',j.source_hash,'review_hash',j.review_hash,'warehouse_id',j.warehouse_id,
 'retry_of',j.retry_of,'expires_at',j.expires_at,'approved',j.approved_at is not null,'publish_count',j.publish_count,
 'row_count',j.row_count,'closed_reason',j.closed_reason,'counts',jsonb_build_object(
 'succeeded',count(*) filter(where status='succeeded'),'unchanged',count(*) filter(where status='unchanged'),
 'conflicted',count(*) filter(where status='conflicted'),'failed',count(*) filter(where status='failed'),'pending',count(*) filter(where status='pending')),
 'items',coalesce(jsonb_agg(jsonb_build_object('product_key',product_key,'product_id',product_id,'operation',case when product_id is null then 'create' else 'update' end,
 'status',status,'reason',reason,'result_id',result_id,'revision',result_revision) order by product_key),'[]'::jsonb))
 from catalog_private.import_items where job_id=j.id
$$;
create function public.catalog_import_status(p_admin_id uuid,p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare j catalog_private.import_jobs%rowtype;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 select * into j from catalog_private.import_jobs where id=p_job_id and actor_id=p_admin_id for update;
 if not found then raise exception 'import:missing' using errcode='P0002';end if;
 perform catalog_private.import_actor(p_admin_id,j.needs_add,j.needs_edit);
 if j.expires_at<=clock_timestamp() and j.closed_reason is null then
  update catalog_private.import_jobs set closed_reason='expired' where id=j.id returning * into j;
  update catalog_private.import_items set status='failed',reason='expired',finished_at=clock_timestamp() where job_id=j.id and status='pending';
 end if;
 return catalog_private.import_summary(j);
end $$;
create function public.catalog_import_find(p_admin_id uuid,p_job_id uuid,p_source text,p_warehouse uuid,p_retry_of uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j catalog_private.import_jobs%rowtype;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 select * into j from catalog_private.import_jobs where id=p_job_id;
 if found then
  if j.actor_id<>p_admin_id or j.source_hash is distinct from p_source or j.warehouse_id is distinct from p_warehouse or j.retry_of is distinct from p_retry_of then raise exception 'import:reused' using errcode='22023';end if;
 else select * into j from catalog_private.import_jobs where actor_id=p_admin_id and source_hash=p_source and warehouse_id is not distinct from p_warehouse and retry_of is not distinct from p_retry_of;
 end if;
 if j.id is null then return null;end if;
 return public.catalog_import_status(p_admin_id,j.id);
end $$;
create function public.catalog_import_options(p_admin_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 select * into a from public.admin_users where id=p_admin_id;
 if a.role<>'owner' and not coalesce((a.permissions->>'products.add')::boolean,false) then return '[]'::jsonb;end if;
 if (select count(*) from public.commerce_warehouses where is_active)>1000 then raise exception 'import:limit' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from public.commerce_warehouses where is_active),'[]'::jsonb);
end $$;
create function public.catalog_import_stage(p_admin_id uuid,p_job_id uuid,p_source text,p_warehouse uuid,p_retry_of uuid,p_items jsonb,p_row_count integer) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare j catalog_private.import_jobs%rowtype; parent catalog_private.import_jobs%rowtype; item jsonb; existing jsonb; mode text; need_add boolean;need_edit boolean;pubs integer;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 if p_job_id is null or p_source is null or p_source !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 250 or octet_length(p_items::text)>8388608
  or p_row_count is null or p_row_count not between 1 and 6000 then raise exception 'import:invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog:import:'||p_admin_id::text||p_source||coalesce(p_warehouse::text,'')||coalesce(p_retry_of::text,''),0));
 existing:=public.catalog_import_find(p_admin_id,p_job_id,p_source,p_warehouse,p_retry_of);
 if existing is not null then
  if (existing->>'approved')::boolean or existing->>'closed_reason' is not null then return existing;end if;
  if jsonb_array_length(p_items)<>(select count(*) from catalog_private.import_items where job_id=(existing->>'id')::uuid)
   or exists(select 1 from jsonb_array_elements(p_items) reviewed(value) where not exists(select 1 from catalog_private.import_items i where i.job_id=(existing->>'id')::uuid and i.product_key=reviewed.value->>'key'
    and i.product_id is not distinct from (reviewed.value->>'id')::uuid and i.expected_revision is not distinct from (reviewed.value->>'revision')::bigint
    and i.graph_hash=sha256(convert_to((reviewed.value->'graph')::text,'UTF8')) and i.command_hash=sha256(convert_to((reviewed.value->'command')::text,'UTF8')))) then raise exception 'import:stale' using errcode='22023';end if;
  return existing;
 end if;
 select exists(select 1 from jsonb_array_elements(p_items) i where i->>'id' is null),exists(select 1 from jsonb_array_elements(p_items) i where i->>'id' is not null),count(*) filter(where (i->>'publish')::boolean) into need_add,need_edit,pubs from jsonb_array_elements(p_items) i;
 perform catalog_private.import_actor(p_admin_id,need_add,need_edit);
 if need_add then
  perform 1 from public.commerce_warehouses where id=p_warehouse and is_active for share;
  if not found then raise exception 'import:warehouse' using errcode='22023';end if;
 elsif p_warehouse is not null then raise exception 'import:warehouse' using errcode='22023';end if;
 if p_retry_of is not null then
  select * into parent from catalog_private.import_jobs where id=p_retry_of and actor_id=p_admin_id for update;
  if not found or exists(select 1 from catalog_private.import_items where job_id=parent.id and status='pending') then raise exception 'import:retry' using errcode='22023';end if;
 end if;
 select coalesce(erp_mode,'built_in') into mode from public.site_settings where key='default' for share;
 insert into catalog_private.import_jobs(id,actor_id,source_hash,warehouse_id,retry_of,review_hash,erp_mode,needs_add,needs_edit,publish_count,row_count)
 values(p_job_id,p_admin_id,p_source,p_warehouse,p_retry_of,'',coalesce(mode,'built_in'),need_add,need_edit,pubs,p_row_count) returning * into j;
 for item in select value from jsonb_array_elements(p_items) loop
  if item->>'key' is null or jsonb_typeof(item->'command') is distinct from 'object' or jsonb_typeof(item->'graph') is distinct from 'object'
   or (item->>'id' is not null and ((item->>'revision') is null or (item->>'revision') !~ '^[0-9]+$')) then raise exception 'import:invalid' using errcode='22023';end if;
  if p_retry_of is not null and not exists(select 1 from catalog_private.import_items i where i.job_id=p_retry_of and i.product_key=item->>'key' and i.status in ('failed','conflicted') and i.product_id is not distinct from (item->>'id')::uuid) then raise exception 'import:retry' using errcode='22023';end if;
  insert into catalog_private.import_items(job_id,product_key,product_id,expected_revision,graph_hash,command_hash)
  values(j.id,item->>'key',(item->>'id')::uuid,(item->>'revision')::bigint,sha256(convert_to((item->'graph')::text,'UTF8')),sha256(convert_to((item->'command')::text,'UTF8')));
 end loop;
 update catalog_private.import_jobs set review_hash=encode(sha256(convert_to(jsonb_build_object('source',p_source,'warehouse',p_warehouse,'retry_of',p_retry_of,'mode',mode,'publish',pubs,'rows',p_row_count,
 'items',(select jsonb_agg(jsonb_build_object('key',product_key,'id',product_id,'revision',expected_revision,'graph',encode(graph_hash,'hex'),'command',encode(command_hash,'hex')) order by product_key) from catalog_private.import_items where job_id=j.id))::text,'UTF8')),'hex') where id=j.id returning * into j;
 return catalog_private.import_summary(j);
end $$;
create function public.catalog_import_approve(p_admin_id uuid,p_job_id uuid,p_review text,p_publish boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare j catalog_private.import_jobs%rowtype; mode text;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 select * into j from catalog_private.import_jobs where id=p_job_id and actor_id=p_admin_id for update;
 if not found then raise exception 'import:missing' using errcode='P0002';end if;
 perform catalog_private.import_actor(p_admin_id,j.needs_add,j.needs_edit);
 if j.review_hash is distinct from p_review then raise exception 'import:stale' using errcode='22023';end if;
 if j.closed_reason is not null or j.expires_at<=clock_timestamp() then return public.catalog_import_status(p_admin_id,j.id);end if;
 if p_publish is null or (j.publish_count>0 and p_publish is not true) then raise exception 'import:publication' using errcode='22023';end if;
 select coalesce(erp_mode,'built_in') into mode from public.site_settings where key='default' for share;
 if coalesce(mode,'built_in')<>j.erp_mode then raise exception 'import:stale' using errcode='22023';end if;
 update catalog_private.import_jobs set approved_at=coalesce(approved_at,clock_timestamp()) where id=j.id returning * into j;
 return catalog_private.import_summary(j);
end $$;
create function public.catalog_import_cancel(p_admin_id uuid,p_job_id uuid,p_review text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare j catalog_private.import_jobs%rowtype;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 select * into j from catalog_private.import_jobs where id=p_job_id and actor_id=p_admin_id for update;
 if not found then raise exception 'import:missing' using errcode='P0002';end if;
 perform catalog_private.import_actor(p_admin_id,j.needs_add,j.needs_edit);
 if j.review_hash is distinct from p_review then raise exception 'import:stale' using errcode='22023';end if;
 update catalog_private.import_jobs set closed_reason=coalesce(closed_reason,'cancelled') where id=j.id returning * into j;
 update catalog_private.import_items set status='failed',reason=j.closed_reason,finished_at=clock_timestamp() where job_id=j.id and status='pending';
 return catalog_private.import_summary(j);
end $$;

-- Serialize only new/changed product SKU claims across ALL writers. Existing
-- duplicate legacy identifiers are not rewritten; unrelated writes stay valid.
create index catalog_products_sku_claim_idx on public.products(lower(sku));
create function catalog_private.import_product_sku_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and lower(old.sku) is not distinct from lower(new.sku) then return new;end if;
 if nullif(new.sku,'') is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog:product-sku:'||lower(new.sku),0));
 if exists(select 1 from public.products where lower(sku)=lower(new.sku) and id<>new.id) then raise exception 'import:identifier' using errcode='23505';end if;
 return new;
end $$;
create trigger catalog_product_sku_claim before insert or update of sku on public.products for each row execute function catalog_private.import_product_sku_guard();

create function catalog_private.import_graph(p_admin uuid,p_id uuid) returns bytea
language plpgsql security definer set search_path='' as $$
declare s jsonb;g jsonb:='{}';k text;
begin
 s:=public.catalog_transfer_snapshot(p_admin,'preview','matching','[]','{}',jsonb_build_object('ids',jsonb_build_array(p_id)),'{}');
 foreach k in array array['variants','specifications','images'] loop
  g:=jsonb_set(g,array[k],coalesce((select jsonb_agg(jsonb_build_object('id',i->'id','hash',i->'expected_hash') order by i->>'id') from jsonb_array_elements(s->k) i),'[]'::jsonb));
 end loop;
 return sha256(convert_to(g::text,'UTF8'));
end $$;


create function catalog_private.import_media_permission(p_admin uuid,p_path text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype; section text; permission text;
begin
 select * into a from public.admin_users where id=p_admin for share;
 if a.role='owner' or coalesce((a.permissions->>'settings.view')::boolean,false) then return;end if;
 section:=case
 when p_path ~ '^/uploads/products/(gallery/)?[^/]+$' then 'products'
 when p_path ~ '^/uploads/categories/[^/]+$' then 'categories'
 when p_path ~ '^/uploads/brands/[^/]+$' then 'brands'
 when p_path ~ '^/uploads/pages/[^/]+$' then 'pages'
 when p_path ~ '^/uploads/settings/(site-logo|auth-page|hero-banners|banner-ads|footer|offer-cards)/[^/]+$' then 'settings'
 else null end;
 if section in ('products','categories','brands') and (coalesce((a.permissions->>(section||'.add'))::boolean,false) or coalesce((a.permissions->>(section||'.edit'))::boolean,false)) then return;end if;
 if section in ('pages','settings') and coalesce((a.permissions->>(section||'.edit'))::boolean,false) then return;end if;
 raise exception 'import:media' using errcode='42501';
end $$;
revoke all on function catalog_private.import_media_permission(uuid,text) from public,anon,authenticated,service_role;

-- Strictly sparse, whitelisted merchandising fields; never a full editor PATCH.
create function catalog_private.import_fields(p_table text,p_fields jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare k text;v jsonb;allowed text[];limits jsonb:='{"title":500,"description":10000,"long_description":100000,"slug":200,"sku":120,"name":120,"code":80,"label":200,"value":100000,"color_name":120,"color_hex":7,"seo_title":1000,"seo_description":10000,"availability_message":500,"alt_text":1000,"image_url":2048,"seo_image_url":2048}';
begin
 allowed:=case p_table
 when 'products' then array['title','slug','sku','description','long_description','category_id','brand_id','price','old_price','selling_mode','is_published','image_url','color_name','color_hex','seo_title','seo_description','seo_image_url','warranty_status','warranty_duration_value','warranty_duration_unit','expected_availability_date','availability_message','preorder_active','preorder_starts_at','preorder_ends_at','preorder_payment_mode','preorder_deposit_percent','preorder_total_limit','preorder_customer_limit']
 when 'variants' then array['name','code','sku','color_name','color_hex','is_active']
 when 'specifications' then array['definition_id','label','value','sort_order','is_highlight']
 when 'images' then array['variant_key','image_url','alt_text','sort_order'] else array[]::text[] end;
 if jsonb_typeof(p_fields) is distinct from 'object' or octet_length(p_fields::text)>600000 then raise exception 'import:invalid' using errcode='22023';end if;
 for k,v in select key,value from jsonb_each(p_fields) loop
  if not(k=any(allowed)) then raise exception 'import:invalid' using errcode='22023';end if;
  if v='null'::jsonb then
   if k in ('title','slug','price','selling_mode','is_published','warranty_status','preorder_active','preorder_payment_mode','name','code','is_active','label','value','sort_order','is_highlight','image_url') and not (k='image_url' and p_table='products') then raise exception 'import:invalid' using errcode='22023';end if;
   continue;
  end if;
  if limits ? k then
   if jsonb_typeof(v)<>'string' or length(v#>>'{}')>(limits->>k)::integer or (k='sku' and v#>>'{}' ~ '[[:cntrl:]]') then raise exception 'import:invalid' using errcode='22023';end if;
  elsif k in ('price','old_price','preorder_deposit_percent') then
   if jsonb_typeof(v) not in ('string','number') or (v#>>'{}') !~ '^[0-9]+(\.[0-9]{1,2})?$' or (v#>>'{}')::numeric>9999999999.99 then raise exception 'import:invalid' using errcode='22023';end if;
  elsif k in ('is_published','is_active','is_highlight','preorder_active') then
   if jsonb_typeof(v)<>'boolean' then raise exception 'import:invalid' using errcode='22023';end if;
  elsif k in ('sort_order','warranty_duration_value','preorder_total_limit','preorder_customer_limit') then
   if jsonb_typeof(v)<>'number' or (v#>>'{}') !~ '^[0-9]+$' or (v#>>'{}')::numeric>2147483647 then raise exception 'import:invalid' using errcode='22023';end if;
  elsif jsonb_typeof(v)<>'string' then raise exception 'import:invalid' using errcode='22023';end if;
 end loop;
end $$;

create function public.catalog_import_apply_item(p_admin_id uuid,p_job_id uuid,p_key text,p_source text,p_review text,p_command jsonb,p_failure text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare j catalog_private.import_jobs%rowtype; i catalog_private.import_items%rowtype; p public.products%rowtype;n public.products%rowtype;
 v public.product_variants%rowtype;nv public.product_variants%rowtype;s public.product_specifications%rowtype;ns public.product_specifications%rowtype;
 im public.product_images%rowtype;ni public.product_images%rowtype; fields jsonb;row jsonb;defs jsonb:='[]';mapping jsonb:='{}'; created jsonb;
 pid uuid;vid uuid;revision bigint;audit uuid;mode text;media_path text;state text;changed boolean:=false;failure text;errstate text;message text;
begin
 perform catalog_private.import_actor(p_admin_id,false,false);
 select * into j from catalog_private.import_jobs where id=p_job_id and actor_id=p_admin_id for update;
 if not found then raise exception 'import:missing' using errcode='P0002';end if;
 perform catalog_private.import_actor(p_admin_id,j.needs_add,j.needs_edit);
 if j.source_hash is distinct from p_source then raise exception 'import:source' using errcode='22023';end if;
 if j.review_hash is distinct from p_review then raise exception 'import:stale' using errcode='22023';end if;
 select * into i from catalog_private.import_items where job_id=j.id and product_key=p_key for update;
 if not found then raise exception 'import:invalid' using errcode='22023';end if;
 if i.status<>'pending' then return catalog_private.import_summary(j);end if;
 if j.closed_reason is not null or j.expires_at<=clock_timestamp() then return public.catalog_import_status(p_admin_id,j.id);end if;
 if j.approved_at is null then raise exception 'import:approval' using errcode='22023';end if;
 -- One nested transaction covers ALL product/related/audit/receipt writes. A caught
 -- failure rolls back this product alone. Its outcome is then committed atomically.
 begin
  select coalesce(erp_mode,'built_in') into mode from public.site_settings where key='default' for share;
  if coalesce(mode,'built_in')<>j.erp_mode then raise exception 'import:stale' using errcode='40001';end if;
  if i.product_id is not null then
   select * into p from public.products where id=i.product_id for update;
   if not found then raise exception 'import:missing' using errcode='40001';end if;
   select r.revision into revision from catalog_private.product_revisions r where product_id=p.id for update;
   if revision is distinct from i.expected_revision then raise exception 'import:conflict' using errcode='40001';end if;
   -- Parent row lock blocks related FK insertions. Lock every existing related row
   -- to cover specs/images (which deliberately do not advance the product revision).
   perform 1 from public.product_variants where product_id=p.id order by id for update;
   perform 1 from public.product_specifications where product_id=p.id order by id for update;
   perform 1 from public.product_images where product_id=p.id order by id for update;
   if catalog_private.import_graph(p_admin_id,p.id)<>i.graph_hash then raise exception 'import:conflict' using errcode='40001';end if;
  end if;
  if p_failure is not null then
   if p_failure not in ('conflict','validation','media') then raise exception 'import:invalid' using errcode='22023';end if;
   raise exception 'import:%',p_failure using errcode='22023';
  end if;
  if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>8388608 or exists(select 1 from jsonb_object_keys(p_command) k where k not in ('fields','variants','specifications','images'))
   or sha256(convert_to(p_command::text,'UTF8'))<>i.command_hash then raise exception 'import:stale' using errcode='40001';end if;
  perform catalog_private.import_fields('products',p_command->'fields');
  foreach mode in array array['variants','specifications','images'] loop
   if jsonb_typeof(p_command->mode) is distinct from 'array' or jsonb_array_length(p_command->mode)>2500 then raise exception 'import:invalid' using errcode='22023';end if;
   for row in select value from jsonb_array_elements(p_command->mode) loop perform catalog_private.import_fields(mode,row->'fields');end loop;
  end loop;
  -- Lock public media paths before any writes, through the receipt commit.
  for media_path in select catalog_private.media_references(p_command) order by 1 loop
   perform catalog_private.import_media_permission(p_admin_id,media_path);
   insert into catalog_private.media_paths(path) values(media_path) on conflict do nothing;
   select m.state into state from catalog_private.media_paths m where m.path=media_path for share;
   if state<>'active' then raise exception 'import:media' using errcode='22023';end if;
  end loop;
  fields:=p_command->'fields';
  if fields->>'category_id' is not null then perform 1 from public.categories where id=(fields->>'category_id')::uuid for share;if not found then raise exception 'import:reference' using errcode='22023';end if;end if;
  if fields->>'brand_id' is not null then perform 1 from public.brands where id=(fields->>'brand_id')::uuid for share;if not found then raise exception 'import:reference' using errcode='22023';end if;end if;
  if i.product_id is null then
   for row in select value from jsonb_array_elements(p_command->'variants') loop
    if row->>'id' is not null or row->'fields'->'is_active' is distinct from 'true'::jsonb then raise exception 'import:invalid' using errcode='22023';end if;
    defs:=defs||jsonb_build_array((row->'fields')-'is_active');
   end loop;
   -- Reuse Task 1 creation, inventory protections, variant domain service and audit.
   -- Force Draft inside the transaction, then validate any approved publication.
   fields:=jsonb_build_object('warranty_status','unknown','selling_mode','normal','preorder_active',false,'preorder_payment_mode','full')||fields||jsonb_build_object('is_serialized',true,'is_published',false,'primary_warehouse_id',j.warehouse_id);
   fields:=jsonb_set(fields,'{price}',to_jsonb((fields->>'price')::numeric));
   if fields->>'old_price' is not null then fields:=jsonb_set(fields,'{old_price}',to_jsonb((fields->>'old_price')::numeric));end if;
   created:=public.catalog_save_product(p_admin_id,i.request_id,'create',null,null,fields,defs);pid:=(created->>'id')::uuid;
   select * into p from public.products where id=pid;
   select audit_id into audit from catalog_private.product_save_receipts where request_id=i.request_id;
   changed:=true;
  else
   pid:=p.id;n:=jsonb_populate_record(p,fields);
   if fields<>'{}'::jsonb then
    update public.products set title=n.title,
     slug=n.slug,
     sku=n.sku,
     description=n.description,
     long_description=n.long_description,
     category_id=n.category_id,
     brand_id=n.brand_id,
     price=n.price,
     old_price=n.old_price,
     selling_mode=n.selling_mode,
     is_published=n.is_published,
     image_url=n.image_url,
     color_name=n.color_name,
     color_hex=n.color_hex,
     seo_title=n.seo_title,
     seo_description=n.seo_description,
     seo_image_url=n.seo_image_url,
     warranty_status=n.warranty_status,
     warranty_duration_value=n.warranty_duration_value,
     warranty_duration_unit=n.warranty_duration_unit,
     expected_availability_date=n.expected_availability_date,
     availability_message=n.availability_message,
     preorder_active=n.preorder_active,
     preorder_starts_at=n.preorder_starts_at,
     preorder_ends_at=n.preorder_ends_at,
     preorder_payment_mode=n.preorder_payment_mode,
     preorder_deposit_percent=n.preorder_deposit_percent,
     preorder_total_limit=n.preorder_total_limit,
     preorder_customer_limit=n.preorder_customer_limit where id=pid returning * into p;changed:=true;
   end if;
  end if;
  -- Sparse option changes never reconcile quantities, prices or costs, or omit
  -- inactive definitions. Exact file keys are mapped only inside this product.
  for row in select value from jsonb_array_elements(p_command->'variants') loop
   fields:=row->'fields';vid:=(row->>'id')::uuid;
   if i.product_id is null then select id into vid from public.product_variants where product_id=pid and is_active and code=fields->>'code';end if;
   if vid is not null then
    select * into v from public.product_variants where id=vid and product_id=pid for update;
    if not found then raise exception 'import:reference' using errcode='22023';end if;
    if fields<>'{}'::jsonb then
     if not p.is_serialized then raise exception 'import:legacy' using errcode='22023';end if;
     nv:=jsonb_populate_record(v,fields);
     if v.is_active and not nv.is_active and exists(select 1 from public.commerce_serialized_units where variant_id=v.id) then raise exception 'import:history' using errcode='22023';end if;
     update public.product_variants set name=nv.name,code=nv.code,sku=nv.sku,color_name=nv.color_name,color_hex=nv.color_hex,is_active=nv.is_active,updated_at=clock_timestamp() where id=v.id;
     changed:=true;
    end if;
   else
    if not p.is_serialized then raise exception 'import:legacy' using errcode='22023';end if;
    nv:=jsonb_populate_record(null::public.product_variants,fields);
    if nv.is_active is not true then raise exception 'import:invalid' using errcode='22023';end if;
    insert into public.product_variants(product_id,name,code,sku,color_name,color_hex,is_active,price,stock_quantity,cost_price)
     values(pid,nv.name,nv.code,nv.sku,nv.color_name,nv.color_hex,true,p.price,0,0) returning id into vid;
    changed:=true;
   end if;
   mapping:=mapping||jsonb_build_object(row->>'key',vid);
  end loop;
  -- Apply the parent-price rule to the final active set, including reactivations.
  if i.product_id is not null and p.is_serialized and p_command->'fields' ? 'price' then
   update public.product_variants set price=p.price,updated_at=clock_timestamp() where product_id=pid and is_active and price is distinct from p.price;
  end if;
  for row in select value from jsonb_array_elements(p_command->'specifications') loop
   fields:=row->'fields';
   if fields->>'definition_id' is not null then
    perform 1 from public.specification_definitions where id=(fields->>'definition_id')::uuid and is_active for share;
    if not found then raise exception 'import:reference' using errcode='22023';end if;
   end if;
   if row->>'id' is not null then
    select * into s from public.product_specifications where id=(row->>'id')::uuid and product_id=pid for update;
    if not found then raise exception 'import:reference' using errcode='22023';end if;
    if fields<>'{}'::jsonb then
     ns:=jsonb_populate_record(s,fields);
     update public.product_specifications set definition_id=ns.definition_id,label=ns.label,value=ns.value,sort_order=ns.sort_order,is_highlight=ns.is_highlight where id=s.id;changed:=true;
    end if;
   else
    ns:=jsonb_populate_record(null::public.product_specifications,fields);
    insert into public.product_specifications(product_id,definition_id,label,value,sort_order,is_highlight) values(pid,ns.definition_id,ns.label,ns.value,ns.sort_order,ns.is_highlight);changed:=true;
   end if;
  end loop;
  for row in select value from jsonb_array_elements(p_command->'images') loop
   fields:=row->'fields';
   if fields ? 'variant_key' then
    vid:=coalesce((mapping->>(fields->>'variant_key'))::uuid,case when fields->>'variant_key' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then (fields->>'variant_key')::uuid else null end);
    perform 1 from public.product_variants where id=vid and product_id=pid and is_active for share;
    if not found then raise exception 'import:reference' using errcode='22023';end if;
    fields:=fields-'variant_key'||jsonb_build_object('variant_id',vid);
   end if;
   if row->>'id' is not null then
    select * into im from public.product_images where id=(row->>'id')::uuid and product_id=pid for update;
    if not found then raise exception 'import:reference' using errcode='22023';end if;
    if fields<>'{}'::jsonb then
     ni:=jsonb_populate_record(im,fields);
     update public.product_images set variant_id=ni.variant_id,image_url=ni.image_url,alt_text=ni.alt_text,sort_order=ni.sort_order where id=im.id;changed:=true;
    end if;
   else
    ni:=jsonb_populate_record(null::public.product_images,fields);
    insert into public.product_images(product_id,variant_id,image_url,alt_text,sort_order) values(pid,ni.variant_id,ni.image_url,ni.alt_text,ni.sort_order);changed:=true;
   end if;
  end loop;
  if i.product_id is null and (p_command->'fields'->>'is_published')::boolean then update public.products set is_published=true where id=pid;end if;
  select * into p from public.products where id=pid;
  -- Domain publication validation is also the final structural/product validator.
  -- Draft changes use the same domain reference/readiness checks as ordinary
  -- saves, without introducing content or positive-stock publication requirements.
  if changed then perform catalog_private.assert_product_publishable(p);end if;
  if not exists(select 1 from public.product_variants where product_id=pid and is_active)
   or p.is_serialized and (select count(*) from public.product_variants where product_id=pid and is_active)>100
   or exists(select 1 from public.product_variants where product_id=pid and is_active and (length(btrim(name)) not between 1 and 120 or code !~ '^[A-Z0-9_-]{1,80}$')) then raise exception 'import:validation' using errcode='22023';end if;
  if changed and i.product_id is not null then
   update catalog_private.product_revisions r set revision=r.revision+1 where r.product_id=pid and r.revision=i.expected_revision;
  end if;
  select r.revision into revision from catalog_private.product_revisions r where product_id=pid;
  if changed then
   if audit is null then
    insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
     select a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,'products.update','Updated product from catalog import.',jsonb_build_object('product_id',pid,'import_job_id',j.id,'product_key',i.product_key,'request_id',i.request_id,'revision',revision) from public.admin_users a where a.id=p_admin_id returning id into audit;
   else
    update public.admin_activity_logs set metadata=metadata||jsonb_build_object('import_job_id',j.id,'product_key',i.product_key,'revision',revision) where id=audit;
    update catalog_private.product_save_receipts set result_revision=revision where request_id=i.request_id;
   end if;
  end if;
  if j.expires_at<=clock_timestamp() then raise exception 'import:expired' using errcode='22023';end if;
  update catalog_private.import_items set status=case when changed then 'succeeded' else 'unchanged' end,reason=null,result_id=pid,result_revision=revision,finished_at=clock_timestamp() where job_id=j.id and product_key=i.product_key;
 exception when others then
  get stacked diagnostics errstate=returned_sqlstate,message=message_text;
  -- Do not expose SQL, catalog values or confidential constraint details.
  failure:=case when errstate='40001' or message in ('import:conflict','catalog:conflict') then 'conflict'
   when errstate='23505' then 'identifier'
   when errstate='23503' then 'reference'
   when message in ('import:media','media:unavailable') then 'media'
   when message='import:history' then 'history'
   when message='import:expired' then 'expired'
   when errstate in ('55P03','40P01','57014') then 'retry'
   else 'validation' end;
  update catalog_private.import_items set status=case when failure='conflict' then 'conflicted' else 'failed' end,reason=failure,finished_at=clock_timestamp() where job_id=j.id and product_key=i.product_key;
 end;
 return catalog_private.import_summary(j);
end $$;

-- All helpers and ledgers stay private. Only named service RPCs are callable.
revoke all on function catalog_private.import_actor(uuid,boolean,boolean),catalog_private.import_summary(catalog_private.import_jobs),
 catalog_private.import_product_sku_guard(),catalog_private.import_graph(uuid,uuid),catalog_private.import_fields(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.catalog_import_status(uuid,uuid),public.catalog_import_find(uuid,uuid,text,uuid,uuid),public.catalog_import_options(uuid),
 public.catalog_import_stage(uuid,uuid,text,uuid,uuid,jsonb,integer),public.catalog_import_approve(uuid,uuid,text,boolean),public.catalog_import_cancel(uuid,uuid,text),
 public.catalog_import_apply_item(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.catalog_import_status(uuid,uuid),public.catalog_import_find(uuid,uuid,text,uuid,uuid),public.catalog_import_options(uuid),
 public.catalog_import_stage(uuid,uuid,text,uuid,uuid,jsonb,integer),public.catalog_import_approve(uuid,uuid,text,boolean),public.catalog_import_cancel(uuid,uuid,text),
 public.catalog_import_apply_item(uuid,uuid,text,text,text,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
