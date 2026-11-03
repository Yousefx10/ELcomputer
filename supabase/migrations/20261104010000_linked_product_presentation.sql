BEGIN;

-- Reuse the existing private presentation store, Products authority, revision,
-- audit and durable receipt. No family table, product identity or SKU mutation.
CREATE FUNCTION catalog_private.sync_product_family(p_product_id uuid,p_family jsonb)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE old_family jsonb; next_family jsonb:=p_family; item jsonb; axis jsonb; vals jsonb;
  keys text[]; target uuid; old_ids uuid[]; new_ids uuid[]; combo jsonb; seen jsonb:='[]';
BEGIN
  SELECT content->'family' INTO old_family FROM catalog_private.product_presentations WHERE product_id=p_product_id;
  old_family:=nullif(old_family,'null'::jsonb);
  IF next_family IS NULL OR next_family='null'::jsonb THEN
    IF old_family IS NULL THEN RETURN; END IF;
    SELECT coalesce(jsonb_agg(value ORDER BY position),'[]'::jsonb) INTO vals
      FROM jsonb_array_elements(old_family->'members') WITH ORDINALITY x(value,position)
      WHERE value->>'product_id'<>p_product_id::text;
    next_family:=CASE WHEN jsonb_array_length(vals)>=2 THEN jsonb_set(old_family,'{members}',vals) ELSE NULL END;
  ELSE
    IF jsonb_typeof(next_family)<>'object' OR next_family-ARRAY['id','axes','members']<>'{}'::jsonb
      OR jsonb_typeof(next_family->'id') IS DISTINCT FROM 'string'
      OR (next_family->>'id')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(next_family->'axes') IS DISTINCT FROM 'array' OR jsonb_typeof(next_family->'members') IS DISTINCT FROM 'array'
      THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(next_family->'axes') NOT BETWEEN 1 AND 6 OR jsonb_array_length(next_family->'members') NOT BETWEEN 2 AND 32
      THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
    keys:=ARRAY[]::text[];
    FOR axis IN SELECT value FROM jsonb_array_elements(next_family->'axes') LOOP
      IF jsonb_typeof(axis)<>'object' OR axis-ARRAY['key','label','label_ar']<>'{}'::jsonb
        OR jsonb_typeof(axis->'key') IS DISTINCT FROM 'string' OR NOT (axis->>'key'=ANY(ARRAY['color','model','switch','capacity','size','version']))
        OR axis->>'key'=ANY(keys) THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      keys:=array_append(keys,axis->>'key');
      IF jsonb_typeof(axis->'label') IS DISTINCT FROM 'string' OR length(axis->>'label') NOT BETWEEN 1 AND 120
        OR btrim(axis->>'label')<>axis->>'label' OR (axis->>'label')~'[[:cntrl:]]'
        OR jsonb_typeof(axis->'label_ar') IS DISTINCT FROM 'string' OR length(axis->>'label_ar')>120
        OR btrim(axis->>'label_ar')<>axis->>'label_ar' OR (axis->>'label_ar')~'[[:cntrl:]]'
        THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
    END LOOP;
    new_ids:=ARRAY[]::uuid[];
    FOR item IN SELECT value FROM jsonb_array_elements(next_family->'members') LOOP
      IF jsonb_typeof(item)<>'object' OR item-ARRAY['product_id','values','values_ar','color_hex']<>'{}'::jsonb
        OR jsonb_typeof(item->'product_id') IS DISTINCT FROM 'string' OR (item->>'product_id')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        OR jsonb_typeof(item->'values') IS DISTINCT FROM 'object' OR jsonb_typeof(item->'values_ar') IS DISTINCT FROM 'object'
        THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      target:=(item->>'product_id')::uuid;
      IF target=ANY(new_ids) OR (item->'values')-keys<>'{}'::jsonb OR (item->'values_ar')-keys<>'{}'::jsonb
        OR (item ? 'color_hex' AND item->'color_hex'<>'null'::jsonb AND (jsonb_typeof(item->'color_hex')<>'string' OR (item->>'color_hex')!~'^#[0-9A-Fa-f]{6}$'))
        THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      new_ids:=array_append(new_ids,target);
      FOREACH combo IN ARRAY ARRAY[item->'values',item->'values_ar'] LOOP
        IF EXISTS(SELECT 1 FROM jsonb_each(combo) e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>120
          OR btrim(e.value#>>'{}')<>e.value#>>'{}' OR (e.value#>>'{}')~'[[:cntrl:]]')
          THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      END LOOP;
      SELECT jsonb_object_agg(key,lower(value#>>'{}')) INTO combo FROM jsonb_each(item->'values');
      IF EXISTS(SELECT 1 FROM unnest(keys) k WHERE coalesce(length(item->'values'->>k),0)=0)
        OR seen @> jsonb_build_array(combo) THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      seen:=seen||jsonb_build_array(combo);
    END LOOP;
    IF NOT p_product_id=ANY(new_ids) OR (old_family IS NOT NULL AND old_family->>'id'<>next_family->>'id')
      THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
  END IF;
  SELECT coalesce(array_agg((value->>'product_id')::uuid),ARRAY[]::uuid[]) INTO old_ids FROM jsonb_array_elements(old_family->'members');
  SELECT coalesce(array_agg((value->>'product_id')::uuid),ARRAY[]::uuid[]) INTO new_ids FROM jsonb_array_elements(next_family->'members');
  -- Same-brand/category membership plus explicit staff confirmation; no inferred links.
  IF (SELECT count(DISTINCT coalesce(brand_id::text,''))>1 OR count(DISTINCT coalesce(category_id::text,''))>1
      FROM public.products WHERE id=ANY(new_ids)) THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM catalog_private.product_presentations p WHERE p.content->'family'->>'id'=next_family->>'id'
      AND NOT p.product_id=ANY(old_ids)) THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
  FOR target IN SELECT DISTINCT id FROM unnest(old_ids||new_ids) id ORDER BY id LOOP
    PERFORM 1 FROM public.products WHERE id=target FOR KEY SHARE;
    IF NOT FOUND THEN
      IF target=ANY(new_ids) THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
      CONTINUE;
    END IF;
    SELECT content->'family' INTO vals FROM catalog_private.product_presentations WHERE product_id=target FOR UPDATE;
    IF vals IS NOT NULL AND vals<>'null'::jsonb AND (old_family IS NULL OR vals<>old_family)
      THEN RAISE EXCEPTION 'pdp:relationship' USING ERRCODE='22023'; END IF;
    IF target=p_product_id THEN CONTINUE; END IF;
    vals:=CASE WHEN target=ANY(new_ids) THEN next_family ELSE NULL END;
    INSERT INTO catalog_private.product_presentations(product_id,revision,content)
      VALUES(target,1,jsonb_build_object('videos','[]'::jsonb,'related','[]'::jsonb,'compatible','[]'::jsonb,'family',vals))
      ON CONFLICT(product_id) DO UPDATE SET revision=product_presentations.revision+1,
        content=jsonb_set(product_presentations.content,'{family}',coalesce(vals,'null'::jsonb)),updated_at=clock_timestamp();
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION catalog_private.sync_product_family(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Exact guarded substitutions retain the installed authority and SKU/accessory code.
DO $patch$
DECLARE s text; old text;
BEGIN
  s:=pg_get_functiondef('public.catalog_save_product_presentation(uuid,uuid,uuid,bigint,jsonb)'::regprocedure);
  old:=$old$p_content-ARRAY['videos','related','compatible']$old$;
  IF (length(s)-length(replace(s,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Family save preimage mismatch'; END IF;
  s:=replace(s,old,$new$p_content-ARRAY['videos','related','compatible','family']$new$);
  old:='  next_revision:=coalesce(current_revision,0)+1;';
  IF (length(s)-length(replace(s,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Family revision preimage mismatch'; END IF;
  s:=replace(s,old,$new$  IF p_content ? 'family' THEN
    IF p_content->'family' IS DISTINCT FROM coalesce((SELECT content->'family' FROM catalog_private.product_presentations WHERE product_id=p_product_id),'null'::jsonb) THEN
      PERFORM catalog_private.sync_product_family(p_product_id,p_content->'family');
    END IF;
  ELSE
    p_content:=p_content||jsonb_build_object('family',(SELECT content->'family' FROM catalog_private.product_presentations WHERE product_id=p_product_id));
  END IF;
  next_revision:=coalesce(current_revision,0)+1;$new$);
  EXECUTE s;
  s:=pg_get_functiondef('public.get_product_presentation(uuid)'::regprocedure);
  old:='  RETURN result;';
  IF (length(s)-length(replace(s,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Family public preimage mismatch'; END IF;
  s:=replace(s,old,$new$  result:=result||jsonb_build_object('family',CASE WHEN jsonb_typeof(c->'family')='object' THEN
    jsonb_build_object('id',c->'family'->'id','axes',c->'family'->'axes','members',coalesce((SELECT jsonb_agg(
      m || jsonb_build_object('slug',p.slug,'title',p.title) ORDER BY position)
      FROM jsonb_array_elements(c->'family'->'members') WITH ORDINALITY x(m,position)
      JOIN public.products p ON p.id=(m->>'product_id')::uuid AND p.is_published
      JOIN catalog_private.product_presentations pp ON pp.product_id=p.id AND pp.content->'family'=c->'family'),'[]'::jsonb)) ELSE NULL END);
  RETURN result;$new$);
  EXECUTE s;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
