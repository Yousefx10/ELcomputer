-- Optional authored SKU choices/prices and curated accessory integrity.
-- No catalog, inventory, historical order or payment evidence is rewritten.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function catalog_private.valid_variant_options(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item record; count_keys integer;
begin
 if value is null or jsonb_typeof(value)<>'object' then return false;end if;
 select count(*) into count_keys from jsonb_object_keys(value);
 if count_keys>8 or (select count(distinct lower(key)) from jsonb_each(value))<>count_keys then return false;end if;
 for item in select * from jsonb_each(value) loop
  if length(item.key) not between 1 and 60 or item.key<>btrim(item.key) or item.key~'[[:cntrl:]]'
   or lower(item.key) in ('__proto__','constructor','prototype') or jsonb_typeof(item.value)<>'string'
   or length(item.value#>>'{}') not between 1 and 120 or (item.value#>>'{}')<>btrim(item.value#>>'{}')
   or (item.value#>>'{}')~'[[:cntrl:]]' then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function catalog_private.valid_variant_options(jsonb) from public,anon,authenticated,service_role;

alter table public.product_variants
 add column sale_price numeric(12,2) check(sale_price is null or sale_price>=0),
 add column option_values jsonb not null default '{}' check(catalog_private.valid_variant_options(option_values));
alter table public.customer_order_items add column variant_options jsonb not null default '{}';
grant select(sale_price,option_values) on public.product_variants to anon,authenticated;

-- Append only public merchandising fields to the existing invoker-scoped view.
create or replace view public.storefront_product_variants with(security_invoker=true) as
 select id,product_id,name,code,sku,color_name,color_hex,price,
 public.erp_storefront_stock('product_variant'::text,id,stock_quantity) as stock_quantity,
 is_active,created_at,updated_at,sale_price,option_values from public.product_variants p;

-- Keep the existing callable OID and all its callers. The private preimage retains
-- the full named-authority, inventory, omission/deactivation and identity guards.
do $$ declare definition text;anchor text:='CREATE OR REPLACE FUNCTION public.commerce_define_product_variants(';begin
 definition:=pg_get_functiondef('public.commerce_define_product_variants(uuid,jsonb,uuid)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'Review the existing variant definition contract.';end if;
 execute replace(definition,anchor,'CREATE OR REPLACE FUNCTION catalog_private.define_product_variants_before_modern(');
end $$;
revoke all on function catalog_private.define_product_variants_before_modern(uuid,jsonb,uuid) from public,anon,authenticated,service_role;

create or replace function public.commerce_define_product_variants(p_product_id uuid,p_variants jsonb,p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;item jsonb;keys text[];candidate_keys text[];row record;
begin
 -- The unchanged implementation first authorizes and locks this exact product.
 result:=catalog_private.define_product_variants_before_modern(p_product_id,p_variants,p_admin_id);
 for item in select value from jsonb_array_elements(p_variants) loop
  if item ? 'option_values' and not catalog_private.valid_variant_options(item->'option_values') then
   raise exception 'catalog:variants' using errcode='22023';end if;
  if item ? 'sale_price' and item->'sale_price'<>'null'::jsonb and
   (jsonb_typeof(item->'sale_price')<>'number' or (item->>'sale_price')::numeric<0
    or (item->>'sale_price')::numeric>=10000000000 or (item->>'sale_price')::numeric<>round((item->>'sale_price')::numeric,2)) then
   raise exception 'catalog:variants' using errcode='22023';end if;
  update public.product_variants v set
   sale_price=case when item ? 'sale_price' then (item->>'sale_price')::numeric else v.sale_price end,
   option_values=case when item ? 'option_values' then item->'option_values' else v.option_values end
  where v.product_id=p_product_id and v.is_active
   and (v.id=nullif(item->>'id','')::uuid or (nullif(item->>'id','') is null and lower(v.code)=lower(item->>'code')))
   and ((item ? 'sale_price' and v.sale_price is distinct from (item->>'sale_price')::numeric)
    or (item ? 'option_values' and v.option_values is distinct from item->'option_values'));
 end loop;
 if exists(select 1 from public.product_variants where product_id=p_product_id and is_active and option_values<>'{}') then
  for row in select option_values from public.product_variants where product_id=p_product_id and is_active order by id loop
   select array_agg(key order by key) into candidate_keys from jsonb_object_keys(row.option_values) key;
   if coalesce(array_length(candidate_keys,1),0)=0 or (keys is not null and keys<>candidate_keys) then
    raise exception 'catalog:variants' using errcode='22023';end if;
   keys:=candidate_keys;
  end loop;
  if exists(select normalized from (select (select jsonb_object_agg(lower(key),lower(value)) from jsonb_each_text(v.option_values)) normalized
   from public.product_variants v where v.product_id=p_product_id and v.is_active) combinations group by normalized having count(*)>1) then
   raise exception 'catalog:variants' using errcode='22023';end if;
 end if;
 return result;
end $$;
revoke all on function public.commerce_define_product_variants(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.commerce_define_product_variants(uuid,jsonb,uuid) to service_role;

-- Minimal exact substitutions preserve all current stock/coupon/COD/provider
-- contracts. Ordinary, external-ERP and preorder creators use the same optional
-- catalog price; no acquisition cost or ERP stock ownership changes.
do $$ declare change record;definition text;begin
 for change in select * from (values
  ('private.checkout_review_before_cod(jsonb)',
   'line_value:=round(product.price,2)*quantity;',
   'line_value:=round(coalesce(variant.sale_price,product.price),2)*quantity;',1),
  ('private.checkout_review_before_cod(jsonb)',
   '''variantName'',variant.name,',
   '''variantName'',variant.name,''variantOptions'',coalesce(variant.option_values,''{}''::jsonb),',1),
  ('public.commerce_create_normal_customer_order_before_backorders(uuid,jsonb,jsonb,boolean,uuid)',
   'round(coalesce(v_product.price, 0)::numeric, 2)',
   'round(coalesce(case when v_product.is_serialized then v_variant.sale_price end,v_product.price,0)::numeric,2)',2),
  ('public.erp_create_external_customer_order(uuid,jsonb,jsonb,boolean,uuid)',
   'round(coalesce(v_product.price, 0)::numeric, 2)',
   'round(coalesce(case when v_product.is_serialized then v_variant.sale_price end,v_product.price,0)::numeric,2)',2),
  ('public.commerce_create_preorder_before_order_sms(uuid,jsonb,jsonb,uuid)',
   'round(v_product.price::numeric, 2)',
   'round(coalesce(case when v_product.is_serialized then v_variant.sale_price end,v_product.price)::numeric,2)',2),
  ('public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)',
   'round(product.price,2)',
   'round(coalesce(variant.sale_price,product.price),2)',2),
  ('private.checkout_review_before_pdc(jsonb)',
   'if product.price<=0 then',
   'if coalesce((select sale_price from public.product_variants where id=(line->>''variant_id'')::uuid and product_id=product.id and is_active),product.price)<=0 then',1),
  ('public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)',
   '''variant_color_hex'',v.color_hex,',
   '''variant_color_hex'',v.color_hex,''variant_options'',coalesce(v.option_values,''{}''::jsonb),',1),
  ('private.finalize_payment_checkout(uuid)',
   'variant_color_hex,unit_price,quantity,line_total)',
   'variant_color_hex,variant_options,unit_price,quantity,line_total)',1),
  ('private.finalize_payment_checkout(uuid)',
   'line->>''variant_color_hex'',',
   'line->>''variant_color_hex'',coalesce(line->''variant_options'',''{}''::jsonb),',1)
 ) patches(signature,old_text,new_text,expected_count) loop
  definition:=pg_get_functiondef(change.signature::regprocedure);
  if (length(definition)-length(replace(definition,change.old_text,'')))/length(change.old_text)<>change.expected_count
   then raise exception 'Review catalog price/snapshot contract: %',change.signature;end if;
  execute replace(definition,change.old_text,change.new_text);
 end loop;
end $$;

-- Curated accessory prices use all active SKU prices in one bounded public read.
-- No category-based compatibility inference or extra browser request is added.
do $$ declare definition text;anchor text:='''price'',p.price,''old_price'',p.old_price';replacement text;begin
 definition:=pg_get_functiondef('public.get_product_presentation(uuid)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'Review the curated product projection.';end if;
 replacement:='''price'',coalesce((select min(coalesce(pv.sale_price,p.price)) from public.product_variants pv where pv.product_id=p.id and pv.is_active),p.price),'
  ||'''max_price'',coalesce((select max(coalesce(pv.sale_price,p.price)) from public.product_variants pv where pv.product_id=p.id and pv.is_active),p.price),''old_price'',p.old_price';
 execute replace(definition,anchor,replacement);
end $$;

-- Future lines retain authored choices. A prepaid checkout uses its immutable
-- preparation snapshot, including an empty old snapshot; never today's variant.
create function catalog_private.capture_order_variant_options() returns trigger
language plpgsql security definer set search_path='' as $$
declare checkout_session uuid;options jsonb;
begin
 select checkout_session_id into checkout_session from public.customer_orders where id=new.order_id;
 -- The existing finalizer supplies its exact immutable snapshot, even if a
 -- product/variant disappeared after the verified payment was prepared.
 if checkout_session is not null then return new;end if;
 select option_values into options from public.product_variants where id=new.variant_id and product_id=new.product_id;
 new.variant_options:=coalesce(options,'{}');
 return new;
end $$;
revoke all on function catalog_private.capture_order_variant_options() from public,anon,authenticated,service_role;
create trigger customer_order_items_variant_options before insert on public.customer_order_items
 for each row execute function catalog_private.capture_order_variant_options();

-- The recovered bounded accessory graph editor is appended below.
CREATE OR REPLACE FUNCTION public.catalog_save_product_presentation(p_admin_id uuid,p_product_id uuid,p_request_id uuid,p_expected_revision bigint,p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE a public.admin_users%ROWTYPE; r catalog_private.product_presentation_receipts%ROWTYPE;
  fingerprint bytea; current_revision bigint; next_revision bigint; row jsonb; target uuid; field text; audit uuid;
BEGIN
  IF p_request_id IS NULL OR p_product_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
    OR p_content IS NULL OR jsonb_typeof(p_content)<>'object' OR octet_length(p_content::text)>65536
    OR p_content-ARRAY['videos','related','compatible']<>'{}'::jsonb THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
  fingerprint:=sha256(convert_to(jsonb_build_object('product',p_product_id,'revision',p_expected_revision,'content',p_content)::text,'UTF8'));
  PERFORM pg_advisory_xact_lock(hashtextextended('pdp:request:'||p_request_id::text,0));
  a:=catalog_private.pdp_editor(p_admin_id,true);
  SELECT * INTO r FROM catalog_private.product_presentation_receipts WHERE request_id=p_request_id;
  IF FOUND THEN
    IF r.actor_id<>p_admin_id OR r.product_id<>p_product_id OR r.payload_hash<>fingerprint THEN RAISE EXCEPTION 'pdp:request_reused' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id) THEN RAISE EXCEPTION 'pdp:not_found' USING ERRCODE='P0002'; END IF;
    RETURN jsonb_build_object('revision',r.result_revision,'request_id',p_request_id,'replayed',true);
  END IF;
  -- Serialize directed accessory graph edits before locking product rows.
  PERFORM pg_advisory_xact_lock(hashtextextended('pdp:accessory-graph',0));
  PERFORM pg_advisory_xact_lock(hashtextextended('pdp:product:'||p_product_id::text,0));
  PERFORM 1 FROM public.products WHERE id=p_product_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pdp:not_found' USING ERRCODE='P0002'; END IF;
  SELECT revision INTO current_revision FROM catalog_private.product_presentations WHERE product_id=p_product_id FOR UPDATE;
  IF coalesce(current_revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'pdp:conflict' USING ERRCODE='PT409'; END IF;
  FOREACH field IN ARRAY ARRAY['videos','related','compatible'] LOOP
    IF jsonb_typeof(p_content->field) IS DISTINCT FROM 'array' OR jsonb_array_length(p_content->field)>(CASE WHEN field='videos' THEN 6 ELSE 8 END)
      THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x->>'asset_id') FROM jsonb_array_elements(p_content->'videos') x)<>jsonb_array_length(p_content->'videos')
    THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(p_content->'videos') LOOP
    IF jsonb_typeof(row)<>'object' OR row-ARRAY['asset_id','label','label_ar','variant_id','sort_order']<>'{}'::jsonb
      OR jsonb_typeof(row->'asset_id') IS DISTINCT FROM 'string' OR (row->>'asset_id')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(row->'sort_order') IS DISTINCT FROM 'number' OR (row->>'sort_order')::numeric NOT BETWEEN 0 AND 9999
      OR (row->>'sort_order')::numeric<>trunc((row->>'sort_order')::numeric)
      THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
    FOREACH field IN ARRAY ARRAY['label','label_ar'] LOOP
      IF jsonb_typeof(row->field) IS DISTINCT FROM 'string' OR length(row->>field)>200 OR (row->>field)~'[[:cntrl:]]'
        THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
    END LOOP;
    IF row->>'variant_id' IS NOT NULL AND ((row->>'variant_id')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS(SELECT 1 FROM public.product_variants v WHERE v.id=(row->>'variant_id')::uuid AND v.product_id=p_product_id AND v.is_active))
      THEN RAISE EXCEPTION 'pdp:variant' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM catalog_private.product_video_assets v WHERE v.id=(row->>'asset_id')::uuid AND v.product_id=p_product_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'pdp:video' USING ERRCODE='22023'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['related','compatible'] LOOP
    IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_content->field))<>jsonb_array_length(p_content->field)
      THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
    FOR row IN SELECT value FROM jsonb_array_elements(p_content->field) LOOP
      IF jsonb_typeof(row)<>'string' OR (row#>>'{}')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN RAISE EXCEPTION 'pdp:invalid' USING ERRCODE='22023'; END IF;
    END LOOP;
    FOR target IN SELECT value::uuid FROM jsonb_array_elements_text(p_content->field) ORDER BY value LOOP
      IF target=p_product_id THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      PERFORM 1 FROM public.products WHERE id=target FOR KEY SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (
    WITH RECURSIVE reachable(id) AS (
      SELECT value::uuid FROM jsonb_array_elements_text(p_content->'compatible')
      UNION
      SELECT child.value::uuid FROM reachable reach JOIN catalog_private.product_presentations p ON p.product_id=reach.id
        CROSS JOIN LATERAL jsonb_array_elements_text(p.content->'compatible') child(value)
    ) SELECT 1 FROM reachable WHERE id=p_product_id
  ) THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
  next_revision:=coalesce(current_revision,0)+1;
  INSERT INTO catalog_private.product_presentations(product_id,revision,content) VALUES(p_product_id,next_revision,p_content)
    ON CONFLICT(product_id) DO UPDATE SET revision=excluded.revision,content=excluded.content,updated_at=clock_timestamp();
  INSERT INTO public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    VALUES(a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,'products.presentation.update','Updated product presentation.',
      jsonb_build_object('product_id',p_product_id,'request_id',p_request_id,'revision',next_revision)) RETURNING id INTO audit;
  INSERT INTO catalog_private.product_presentation_receipts(request_id,actor_id,product_id,payload_hash,result_revision,audit_id)
    VALUES(p_request_id,p_admin_id,p_product_id,fingerprint,next_revision,audit);
  RETURN jsonb_build_object('revision',next_revision,'request_id',p_request_id,'replayed',false);
END $$;
notify pgrst,'reload schema';
commit;
