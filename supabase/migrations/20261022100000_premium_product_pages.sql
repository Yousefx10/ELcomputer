BEGIN;

-- Existing deployments remain Classic until an authorized editor selects Premium.
ALTER TABLE public.site_settings
  ADD COLUMN product_page_style text NOT NULL DEFAULT 'classic',
  ADD COLUMN product_page_config jsonb;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_product_page_style_check
    CHECK (product_page_style IN ('classic', 'premium')),
  ADD CONSTRAINT site_settings_product_page_config_check
    CHECK (product_page_config IS NULL OR
      (jsonb_typeof(product_page_config) = 'object' AND octet_length(product_page_config::text) <= 32768));

COMMENT ON COLUMN public.site_settings.product_page_style IS
  'Global product presentation. Classic preserves the existing UI; selection never activates commerce.';
COMMENT ON COLUMN public.site_settings.product_page_config IS
  'Optional Premium section visibility and authored policy links; no product, price or inventory authority.';

-- Only missing presentation metadata is added. No existing catalog row is rewritten.
CREATE TABLE catalog_private.product_presentations (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  content jsonb NOT NULL DEFAULT '{"videos":[],"related":[],"compatible":[]}'::jsonb
    CHECK (jsonb_typeof(content)='object' AND octet_length(content::text)<=65536),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE catalog_private.product_video_assets (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('video/mp4','video/webm')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 67108864),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  duration_seconds numeric NOT NULL CHECK (duration_seconds>0 AND duration_seconds<=600),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (storage_key=id::text||CASE mime_type WHEN 'video/mp4' THEN '.mp4' ELSE '.webm' END)
);
CREATE INDEX product_video_assets_product ON catalog_private.product_video_assets(product_id,id);
CREATE TABLE catalog_private.product_presentation_receipts (
  request_id uuid PRIMARY KEY, actor_id uuid NOT NULL, product_id uuid NOT NULL,
  payload_hash bytea NOT NULL, result_revision bigint NOT NULL, audit_id uuid,
  completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE catalog_private.product_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_private.product_video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_private.product_presentation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_private.product_presentations,catalog_private.product_video_assets,
  catalog_private.product_presentation_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION catalog_private.pdp_editor(p_admin_id uuid,p_lock boolean DEFAULT false)
RETURNS public.admin_users LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin_users%ROWTYPE;
BEGIN
  IF p_lock THEN PERFORM pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0)); END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'pdp:permission' USING ERRCODE='42501'; END IF;
  IF p_lock THEN SELECT * INTO a FROM public.admin_users WHERE id=p_admin_id FOR SHARE;
  ELSE SELECT * INTO a FROM public.admin_users WHERE id=p_admin_id; END IF;
  IF NOT FOUND OR NOT a.is_active OR NOT (a.role='owner' OR
    (coalesce((a.permissions->>'products.view')::boolean,false) AND coalesce((a.permissions->>'products.edit')::boolean,false)))
    THEN RAISE EXCEPTION 'pdp:permission' USING ERRCODE='42501'; END IF;
  RETURN a;
END $$;

CREATE FUNCTION public.catalog_product_presentation(p_admin_id uuid,p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  PERFORM catalog_private.pdp_editor(p_admin_id);
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id) THEN RAISE EXCEPTION 'pdp:not_found' USING ERRCODE='P0002'; END IF;
  SELECT jsonb_build_object('revision',p.revision,'content',p.content) INTO result
    FROM catalog_private.product_presentations p WHERE p.product_id=p_product_id;
  RETURN coalesce(result,jsonb_build_object('revision',0,'content',jsonb_build_object('videos','[]'::jsonb,'related','[]'::jsonb,'compatible','[]'::jsonb))) ||
    jsonb_build_object('assets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'url','/uploads/product_videos/'||a.storage_key,
      'mime_type',a.mime_type,'size_bytes',a.size_bytes,'duration_seconds',a.duration_seconds) ORDER BY a.created_at,a.id)
      FROM (SELECT a.* FROM catalog_private.product_video_assets a WHERE a.product_id=p_product_id
        ORDER BY CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(result->'content'->'videos') v WHERE v->>'asset_id'=a.id::text) THEN 0 ELSE 1 END,
        a.created_at DESC,a.id LIMIT 56) a),'[]'::jsonb));
END $$;

CREATE FUNCTION public.catalog_save_product_presentation(p_admin_id uuid,p_product_id uuid,p_request_id uuid,p_expected_revision bigint,p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  PERFORM pg_advisory_xact_lock(hashtextextended('pdp:product:'||p_product_id::text,0));
  PERFORM 1 FROM public.products WHERE id=p_product_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pdp:not_found' USING ERRCODE='P0002'; END IF;
  SELECT revision INTO current_revision FROM catalog_private.product_presentations WHERE product_id=p_product_id FOR UPDATE;
  IF coalesce(current_revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'pdp:conflict' USING ERRCODE='40001'; END IF;
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

CREATE FUNCTION public.catalog_product_presentation_status(p_admin_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r catalog_private.product_presentation_receipts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('pdp:request:'||p_request_id::text,0));
  PERFORM catalog_private.pdp_editor(p_admin_id,true);
  SELECT * INTO r FROM catalog_private.product_presentation_receipts WHERE request_id=p_request_id AND actor_id=p_admin_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('committed',false); END IF;
  RETURN jsonb_build_object('committed',true,'product_id',r.product_id,'revision',r.result_revision,'request_id',r.request_id);
END $$;

CREATE FUNCTION public.catalog_register_product_video(p_admin_id uuid,p_product_id uuid,p_id uuid,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_duration numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing catalog_private.product_video_assets%ROWTYPE; key text;
BEGIN
  PERFORM catalog_private.pdp_editor(p_admin_id,true);
  IF p_id IS NULL OR p_product_id IS NULL OR p_mime_type IS NULL OR p_mime_type NOT IN ('video/mp4','video/webm')
    OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 67108864 OR p_sha256 IS NULL OR p_sha256!~'^[a-f0-9]{64}$'
    OR p_duration IS NULL OR p_duration<=0 OR p_duration>600 THEN RAISE EXCEPTION 'pdp:video' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.products WHERE id=p_product_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pdp:not_found' USING ERRCODE='P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pdp:video:'||p_id::text,0));
  SELECT * INTO existing FROM catalog_private.product_video_assets WHERE id=p_id;
  IF FOUND THEN
    IF existing.product_id<>p_product_id OR existing.mime_type<>p_mime_type OR existing.size_bytes<>p_size_bytes OR existing.sha256<>p_sha256
      OR existing.duration_seconds<>p_duration THEN RAISE EXCEPTION 'pdp:request_reused' USING ERRCODE='22023'; END IF;
  ELSE
    key:=p_id::text||CASE p_mime_type WHEN 'video/mp4' THEN '.mp4' ELSE '.webm' END;
    INSERT INTO catalog_private.product_video_assets(id,product_id,storage_key,mime_type,size_bytes,sha256,duration_seconds)
      VALUES(p_id,p_product_id,key,p_mime_type,p_size_bytes,p_sha256,p_duration);
  END IF;
  RETURN jsonb_build_object('id',p_id,'url','/uploads/product_videos/'||p_id::text||CASE p_mime_type WHEN 'video/mp4' THEN '.mp4' ELSE '.webm' END,
    'mime_type',p_mime_type,'size_bytes',p_size_bytes,'duration_seconds',p_duration);
END $$;

-- Public projection explicitly filters BOTH ends of every relationship and option.
CREATE FUNCTION public.get_product_presentation(p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; result jsonb; field text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.products WHERE id=p_product_id AND is_published) THEN RETURN NULL; END IF;
  SELECT content INTO c FROM catalog_private.product_presentations WHERE product_id=p_product_id;
  c:=coalesce(c,'{"videos":[],"related":[],"compatible":[]}'::jsonb);
  result:=jsonb_build_object('related_curated',jsonb_array_length(c->'related')>0,'videos',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'url','/uploads/product_videos/'||a.storage_key,
    'label',v->>'label','label_ar',v->>'label_ar','variant_id',v->>'variant_id','sort_order',(v->>'sort_order')::integer)
    ORDER BY (v->>'sort_order')::integer,position)
    FROM jsonb_array_elements(c->'videos') WITH ORDINALITY x(v,position)
    JOIN catalog_private.product_video_assets a ON a.id=(v->>'asset_id')::uuid AND a.product_id=p_product_id
    WHERE v->>'variant_id' IS NULL OR EXISTS(SELECT 1 FROM public.product_variants pv
      WHERE pv.id=(v->>'variant_id')::uuid AND pv.product_id=p_product_id AND pv.is_active)),'[]'::jsonb));
  FOREACH field IN ARRAY ARRAY['related','compatible'] LOOP
    result:=result||jsonb_build_object(field,coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'slug',p.slug,
      'price',p.price,'old_price',p.old_price,'image_url',p.image_url,'stock_quantity',p.stock_quantity,'is_serialized',p.is_serialized,
      'selling_mode',p.selling_mode,'preorder_active',p.preorder_active,'is_published',true) ORDER BY position)
      FROM jsonb_array_elements_text(c->field) WITH ORDINALITY x(id,position)
      JOIN public.storefront_products p ON p.id=x.id::uuid AND p.is_published AND p.id<>p_product_id),'[]'::jsonb));
  END LOOP;
  RETURN result;
END $$;

CREATE FUNCTION public.get_public_product_video(p_asset_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('storage_key',a.storage_key,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'sha256',a.sha256)
  FROM catalog_private.product_video_assets a JOIN public.products p ON p.id=a.product_id AND p.is_published
  JOIN catalog_private.product_presentations d ON d.product_id=p.id
  WHERE a.id=p_asset_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.content->'videos') v
    WHERE v->>'asset_id'=a.id::text AND (v->>'variant_id' IS NULL OR EXISTS(SELECT 1 FROM public.product_variants pv
      WHERE pv.id=(v->>'variant_id')::uuid AND pv.product_id=p.id AND pv.is_active)))
$$;

REVOKE ALL ON FUNCTION catalog_private.pdp_editor(uuid,boolean),
  public.catalog_product_presentation(uuid,uuid),public.catalog_save_product_presentation(uuid,uuid,uuid,bigint,jsonb),
  public.catalog_product_presentation_status(uuid,uuid),public.catalog_register_product_video(uuid,uuid,uuid,text,bigint,text,numeric),
  public.get_product_presentation(uuid),public.get_public_product_video(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.catalog_product_presentation(uuid,uuid),
  public.catalog_save_product_presentation(uuid,uuid,uuid,bigint,jsonb),public.catalog_product_presentation_status(uuid,uuid),
  public.catalog_register_product_video(uuid,uuid,uuid,text,bigint,text,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product_presentation(uuid),public.get_public_product_video(uuid) TO anon,authenticated,service_role;

-- Cover authored metadata with the existing image reference protocol.
CREATE TRIGGER media_reference_guard BEFORE INSERT OR UPDATE ON catalog_private.product_presentations
  FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_media_references();

create or replace function public.catalog_media_delete(p_admin_id uuid,p_path text,p_finish boolean default false)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor public.admin_users%rowtype; tab text; used boolean; current_state text;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0));
  if auth.role() is distinct from 'service_role' then raise exception 'MEDIA_FORBIDDEN'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'MEDIA_ISOLATION_REQUIRED'; end if;
  select * into actor from public.admin_users where id=p_admin_id for share;
  if actor.id is null or not actor.is_active or (actor.role <> 'owner' and not
    (coalesce((actor.permissions->>'settings.view')::boolean,false) and coalesce((actor.permissions->>'settings.edit')::boolean,false))) then
    raise exception 'MEDIA_FORBIDDEN';
  end if;
  if p_path is null or length(p_path)>512 or p_path !~* '^/uploads/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|gif|webp|avif|svg)$'
    or p_path ~ '(^|/)\.\.?(/|$)' or p_path like '%//%' then raise exception 'MEDIA_PATH_INVALID'; end if;
  p_path:=lower(p_path);
  insert into catalog_private.media_paths(path) values(p_path) on conflict(path) do nothing;
  select state into current_state from catalog_private.media_paths where path=p_path for update;
  if current_state='deleted' then return jsonb_build_object('state','deleted'); end if;
  -- A fresh statement snapshot after the path lock observes committed reference writers.
  foreach tab in array array['products','product_variants','product_images','product_specifications',
    'categories','brands','site_settings','site_pages','site_hero_banners','site_offer_cards',
    'site_links','site_top_bar_messages','help_articles','customer_order_items'] loop
    execute format('select exists(select 1 from public.%I r, lateral catalog_private.media_references(to_jsonb(r)) x where x=$1)',tab)
      into used using p_path;
    if used then raise exception 'MEDIA_REFERENCED'; end if;
  end loop;
  -- Authored labels may contain managed image URLs.
  if exists(select 1 from catalog_private.product_presentations r,
    lateral catalog_private.media_references(to_jsonb(r)) x where x=p_path) then
    raise exception 'MEDIA_REFERENCED';
  end if;
  if p_finish and current_state <> 'deleting' then raise exception 'MEDIA_DELETE_NOT_RESERVED'; end if;
  update catalog_private.media_paths set state=case when p_finish then 'deleted' else 'deleting' end,
    updated_at=clock_timestamp() where path=p_path;
  return jsonb_build_object('state',case when p_finish then 'deleted' else 'deleting' end);
end $$;

-- Register only these three new private tables. Unknown-table rejection remains.
-- Product-owned rows cascade; minimal save receipts remain replay tombstones.
DO $pdp_reset$ DECLARE definition text; anchor text :=
  '''product_revisions'',''product_save_receipts'',''media_paths'',''product_bulk_receipts'',''import_jobs'',''import_items''';
BEGIN
  definition := pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
  IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Review PDP reset coverage before release.'; END IF;
  EXECUTE replace(definition,anchor,anchor||',''product_presentations'',''product_video_assets'',''product_presentation_receipts''');
END $pdp_reset$;

NOTIFY pgrst,'reload schema';
COMMIT;
