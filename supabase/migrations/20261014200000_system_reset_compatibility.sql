-- 79: guarded reset/file recovery, import invalidation and disabled singletons.
-- Historical migrations, managed Storage ownership and bootstrap stay unchanged.
begin;
set local lock_timeout='5s';

alter table public.system_reset_runs add column cleanup_progress jsonb not null default '{}';
alter table catalog_private.import_jobs drop constraint import_jobs_closed_reason_check;
alter table catalog_private.import_jobs add constraint import_jobs_closed_reason_check
 check(closed_reason in ('cancelled','expired','reset'));

create function catalog_private.reset_assert_coverage() returns void
language plpgsql security definer set search_path='' as $$
declare unknown_tables boolean;
begin
 select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and (
   (n.nspname='public' and not c.relname=any(public.system_reset_tables('full')||array[
    'admin_users','system_reset_runs','system_reset_attempts',
    'after_sales_policies','after_sales_return_reasons','after_sales_policy_versions',
    'after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence',
    'shipping_claim_jobs','email_provider_settings','email_templates','email_preferences','email_messages',
    'email_attempts','email_events','after_sales_communication_settings','after_sales_communications',
    'quick_setup_state','quick_setup_revisions','quick_setup_events'])) or
   (n.nspname='private' and c.relname<>'installation_bootstrap') or
   (n.nspname='catalog_private' and not c.relname=any(array[
    'product_revisions','product_save_receipts','media_paths','product_bulk_receipts','import_jobs','import_items']))
  )) into unknown_tables;
 if unknown_tables then raise exception 'Unrecognized tables found. Review the reset policy first.';end if;
end $$;

-- Shared authority is taken BEFORE import authorization/job/product locks.
-- An already running import prevents reset; a waiting old approval sees closure.
do $guard$ declare definition text; anchor text:=' perform catalog_private.import_actor';begin
 definition:=pg_get_functiondef('catalog_private.import_actor(uuid,boolean,boolean)'::regprocedure);
 if position(E'begin\n if auth.role()' in definition)=0 then raise exception 'Review import reset lock order.';end if;
 execute replace(definition,E'begin\n if auth.role()',E'begin\n perform pg_advisory_xact_lock_shared(hashtextextended(''elcomputer-system-reset'',0));\n if auth.role()');
 definition:=pg_get_functiondef('public.catalog_media_delete(uuid,text,boolean)'::regprocedure);
 if position(E'begin\n  if auth.role()' in definition)=0 then raise exception 'Review media reset lock order.';end if;
 execute replace(definition,E'begin\n  if auth.role()',E'begin\n  perform pg_advisory_xact_lock_shared(hashtextextended(''elcomputer-system-reset'',0));\n  if auth.role()');
end $guard$;

create function catalog_private.reset_media_paths(p_files jsonb) returns text[]
language plpgsql immutable set search_path='' as $$
declare f jsonb; paths text[]:=array[]::text[]; path text;
begin
 if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>10000
  or octet_length(p_files::text)>8388608 then raise exception 'Invalid reset upload manifest.' using errcode='22023';end if;
 for f in select value from jsonb_array_elements(p_files) loop
  path:=f->>'path';
  if jsonb_typeof(f) is distinct from 'object' or path is null or length(path)>500
   or path !~* '^((products/(gallery/)?|categories/|brands/|pages/|settings/(site-logo|auth-page|hero-banners|banner-ads|footer|offer-cards)/)?[A-Za-z0-9_][A-Za-z0-9_.-]*\.(jpg|jpeg|png|gif|webp|avif|svg))$'
   or jsonb_typeof(f->'root') is distinct from 'string' or f->>'root' not like '/%'
   or jsonb_typeof(f->'size') is distinct from 'number' or (f->>'size')::numeric<0
   or jsonb_typeof(f->'modifiedAt') is distinct from 'number' then
   raise exception 'Invalid reset upload manifest.' using errcode='22023';
  end if;
  paths:=array_append(paths,lower('/uploads/'||path));
 end loop;
 -- Case aliases share the existing conservative media reservation.
 return array(select distinct x from unnest(paths) x order by x);
end $$;

create function catalog_private.reset_media_columns() returns text[]
language sql immutable set search_path='' as $$
 select array['image_url','logo_url','seo_image_url','site_logo_url','banner_ad_1_image_url',
  'banner_ad_2_image_url','footer_modern_card_image_url','footer_modern_community_image_url',
  'footer_modern_banner_image_url','seo_social_image_url']::text[]
$$;
create function catalog_private.reset_media_tables() returns text[]
language sql immutable set search_path='' as $$
 select array['products','product_variants','product_images','product_specifications','categories','brands',
  'site_settings','site_pages','site_hero_banners','site_offer_cards','site_links','site_top_bar_messages',
  'help_articles','customer_order_items']::text[]
$$;

-- A virtual projection clears only complete, relative image URL fields. Authored
-- markdown/HTML/specifications/nested JSON and all external URLs are untouched.
create function catalog_private.reset_media_projection(p_document jsonb,p_paths text[]) returns jsonb
language plpgsql immutable set search_path='' as $$
declare key text; value text;
begin
 foreach key in array catalog_private.reset_media_columns() loop
  value:=p_document->>key;
  if value like '/uploads/%' then
   if lower(catalog_private.media_canonical(catalog_private.media_decode(split_part(split_part(value,'?',1),'#',1))))=any(p_paths) then
    p_document:=jsonb_set(p_document,array[key],'""'::jsonb);
   end if;
  end if;
 end loop;
 return p_document;
end $$;

create function public.system_reset_media_plan(p_owner uuid,p_files jsonb,p_scope text default 'media') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare paths text[]:=catalog_private.reset_media_paths(p_files); tab text; n bigint; blockers jsonb:='[]';
begin
 perform public.system_reset_assert_owner(p_owner);perform catalog_private.reset_assert_coverage();
 if p_scope not in ('media','full') then raise exception 'Unsupported reset option.' using errcode='22023';end if;
 foreach tab in array catalog_private.reset_media_tables() loop
  -- Full deletes these tables. Media must preserve unresolved authored content.
  if p_scope='full' and tab=any(public.system_reset_tables('full')) then continue;end if;
  execute format('select count(*) from public.%I r where exists(select 1 from catalog_private.media_references(catalog_private.reset_media_projection(to_jsonb(r),$1)) x where x=any($1))',tab)
   into n using paths;
  if n>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('table',tab,'count',n));end if;
 end loop;
 return jsonb_build_object('blockers',blockers,'mediaFiles',jsonb_array_length(p_files));
end $$;

create function catalog_private.reset_clear_media(p_owner uuid,p_files jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare paths text[]:=catalog_private.reset_media_paths(p_files); col record; path text; plan jsonb; affected uuid[];
begin
 plan:=public.system_reset_media_plan(p_owner,p_files);
 if jsonb_array_length(plan->'blockers')>0 then
  raise exception 'Images remain in authored content. Remove those references first.';
 end if;
 select array_agg(distinct id) into affected from (
  select p.id from public.products p,lateral catalog_private.media_references(to_jsonb(p)) x where x=any(paths)
  union select v.product_id from public.product_variants v,lateral catalog_private.media_references(to_jsonb(v)) x where x=any(paths)
  union select i.product_id from public.product_images i,lateral catalog_private.media_references(to_jsonb(i)) x where x=any(paths)
 ) products;
 for col in select table_name,column_name from information_schema.columns where table_schema='public'
  and table_name=any(catalog_private.reset_media_tables()) and column_name=any(catalog_private.reset_media_columns())
  and data_type in ('text','character varying') order by table_name,column_name loop
  -- Reference and editorial triggers remain enabled for these updates.
  execute format('update public.%I set %I=%L where case when %I like %L then lower(catalog_private.media_canonical(catalog_private.media_decode(split_part(split_part(%I,''?'',1),''#'',1)))) end=any($1)',
   col.table_name,col.column_name,'',col.column_name,'/uploads/%',col.column_name) using paths;
 end loop;
 -- Galleries/SEO can change independently of the main revision trigger.
 -- Conservative advancement also protects loaded variants/section snapshots.
 update catalog_private.product_revisions r set revision=r.revision+1 where r.product_id=any(affected);
 foreach path in array paths loop perform public.catalog_media_delete(p_owner,path,false);end loop;
end $$;

-- Keep the established FK/trigger engine, but remove its unsafe legacy media
-- updates. The new clear/reservation phase runs before triggers are suspended.
alter function public.system_reset_begin(uuid,text,uuid,jsonb) set schema catalog_private;
alter function catalog_private.system_reset_begin(uuid,text,uuid,jsonb) rename to system_reset_begin_legacy;
revoke all on function catalog_private.system_reset_begin_legacy(uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
do $engine$ declare definition text; media text:=E'  if p_scope = ''media'' then\n    for v_column';full_reset text:=E'  if p_scope = ''full'' then\n    delete from public.admin_users';history text:='delete from public.system_reset_runs where id <> p_id;';begin
 definition:=pg_get_functiondef('catalog_private.system_reset_begin_legacy(uuid,text,uuid,jsonb)'::regprocedure);
 if position(media in definition)=0 or position(full_reset in definition)=0 or position(history in definition)=0 then raise exception 'Review reset engine compatibility.';end if;
 definition:=replace(definition,media,E'  if false then\n    for v_column');
 definition:=replace(definition,'from storage.objects where bucket_id = ''admin-documents''','from (select name from storage.objects where bucket_id=''admin-documents'' order by name limit 10001) objects');
 definition:=replace(definition,'from auth.users where id <> p_owner','from (select id from auth.users where id<>p_owner order by id limit 10001) users');
 -- Full removes old actor/count payloads, never the consumed request IDs.
 definition:=replace(definition,history,'update public.system_reset_runs set actor=''{}'',summary=''{}'',manifest=''{}'',cleanup_progress=''{}'' where id<>p_id and status=''completed'';');
 definition:=replace(definition,full_reset,$seed$
  if p_scope = 'full' then
    insert into public.chat_settings(singleton,is_enabled,attachments_enabled,auto_assignment_enabled,sound_notifications_enabled,request_call_enabled)
      values(true,false,false,false,false,false);
    insert into public.shipping_provider_settings(id,display_name,base_url,company_id,product_id)
      values('pdc','PDC Courier','https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',null,null);
    delete from public.admin_users$seed$);
 execute definition;
end $engine$;

-- Version-2 captures are bounded by the new trigger below. Leave the historical
-- trigger contract intact for an explicitly preserved older pending journal.
do $capture$ declare definition text; name text;begin
 foreach name in array array['support_reset_manifest','chat_reset_manifest'] loop
  definition:=pg_get_functiondef(format('public.%I()',name)::regprocedure);
  if position(E'begin\n  if new.scope' in definition)=0 then raise exception 'Review private attachment capture.';end if;
  execute replace(definition,E'begin\n  if new.scope',E'begin\n  if new.manifest->>''format''=''2'' then return new;end if;\n  if new.scope');
 end loop;
end $capture$;

create function catalog_private.reset_manifest() returns trigger
language plpgsql security definer set search_path='' as $$
declare paths jsonb; bucket text; kind text; n integer;
begin
 if new.manifest->>'format' is distinct from '2' then return new;end if;
 if new.scope='media' then perform catalog_private.reset_clear_media(new.owner_id,new.manifest->'media');end if;
 if new.scope in ('products','full') then
  update catalog_private.import_jobs j set closed_reason='reset'
   where j.closed_reason is null and exists(select 1 from catalog_private.import_items i where i.job_id=j.id and i.status='pending');
  update catalog_private.import_items i set status='failed',reason='reset',finished_at=clock_timestamp()
   where i.status='pending' and exists(select 1 from catalog_private.import_jobs j where j.id=i.job_id and j.closed_reason='reset');
 end if;
 if new.scope in ('orders','commerce','full') then
  if exists(select 1 from public.order_packing_videos where status='uploading')
   or exists(select 1 from public.shipping_order_jobs where state in ('submitting','label_pending')) then
   raise exception 'Finish pending packing or shipping work before resetting.';
  end if;
 end if;
 -- Capture before the corresponding business rows are deleted. Never write to
 -- managed Storage tables. Full owns these six application buckets only.
 foreach kind in array array['documents','support','chat','packing','labels','evidence'] loop
  paths:='[]';bucket:=case kind when 'documents' then 'admin-documents' when 'support' then 'support-attachments'
   when 'chat' then 'chat-attachments' when 'packing' then 'order-packing-videos' when 'labels' then 'shipping-labels' else 'after-sales-evidence' end;
  if new.scope='full' then
   select coalesce(jsonb_agg(name order by name),'[]') into paths from (
    select o.name from storage.objects o where o.bucket_id=bucket
     and not(kind='evidence' and exists(select 1 from public.after_sales_claim_evidence e where e.storage_path=o.name))
     and not(kind='labels' and exists(select 1 from public.shipping_claim_jobs j where j.label_storage_path=o.name))
     order by o.name limit 10001) objects;
  elsif new.scope='documents' and kind='documents' then
   select coalesce(jsonb_agg(name order by name),'[]') into paths from (
    select name from storage.objects where bucket_id=bucket order by name limit 10001) objects;
  elsif new.scope in ('orders','commerce') and kind='packing' then
   select coalesce(jsonb_agg(storage_path order by storage_path),'[]') into paths from (
    select distinct storage_path from public.order_packing_videos order by storage_path limit 10001) objects;
  elsif new.scope in ('orders','commerce') and kind='labels' then
   select coalesce(jsonb_agg(label_storage_path order by label_storage_path),'[]') into paths from (
    select distinct label_storage_path from public.shipping_order_jobs where label_storage_path is not null
     and not exists(select 1 from public.shipping_claim_jobs j where j.label_storage_path=shipping_order_jobs.label_storage_path)
     order by label_storage_path limit 10001) objects;
  end if;
  new.manifest:=jsonb_set(new.manifest,array[kind],paths);
 end loop;
 select sum(jsonb_array_length(value)) into n from jsonb_each(new.manifest) where jsonb_typeof(value)='array';
 if n>10000 then raise exception 'Too many cleanup items. Reset a smaller scope first.';end if;
 return new;
end $$;
-- Existing chat/support BEFORE triggers run first; this last trigger bounds the
-- complete manifest and shares the same database transaction/invalidation.
create trigger zz_reset_compatibility_manifest before insert on public.system_reset_runs
 for each row execute function catalog_private.reset_manifest();

-- Writers waiting behind the reset's table locks must not attach new business
-- metadata to private object names already captured for deletion.
create function catalog_private.reset_storage_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare path text:=to_jsonb(new)->>tg_argv[1];
begin
 if path is null or (tg_op='UPDATE' and path is not distinct from to_jsonb(old)->>tg_argv[1]) then return new;end if;
 if exists(select 1 from public.system_reset_runs r where r.status='cleanup_pending'
  and coalesce(r.manifest->tg_argv[0],'[]') ? path) then
  raise exception 'This file is reserved by a pending reset.' using errcode='40001';
 end if;
 return new;
end $$;
do $references$ declare item text[];begin
 foreach item slice 1 in array array[
  ['documents','documents','storage_path'],['support_ticket_attachments','support','storage_path'],
  ['chat_attachments','chat','storage_path'],['order_packing_videos','packing','storage_path'],
  ['shipping_order_jobs','labels','label_storage_path'],['shipping_claim_jobs','labels','label_storage_path'],
  ['after_sales_claim_evidence','evidence','storage_path']] loop
  execute format('create trigger zz_reset_storage_reference before insert or update on public.%I for each row execute function catalog_private.reset_storage_reference(%L,%L)',item[1],item[2],item[3]);
 end loop;
end $references$;

-- Mark this engine's captures. Old pending resets remain paused for review.
do $format$ declare definition text; anchor text:='jsonb_build_object(''media'', p_media_files, ''documents'', ''[]''::jsonb, ''users'', ''[]''::jsonb)';begin
 definition:=pg_get_functiondef('catalog_private.system_reset_begin_legacy(uuid,text,uuid,jsonb)'::regprocedure);
 if position(anchor in definition)=0 then raise exception 'Review reset manifest format.';end if;
 execute replace(definition,anchor,'jsonb_build_object(''format'',2,''media'',p_media_files,''documents'',''[]''::jsonb,''users'',''[]''::jsonb)');
end $format$;

create function public.system_reset_begin(p_owner uuid,p_scope text,p_id uuid,p_media_files jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='10s' set statement_timeout='120s' as $$
declare run public.system_reset_runs; path text;
begin
 perform public.system_reset_assert_owner(p_owner);
 if not pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) then raise exception 'Another reset or catalog operation is running.';end if;
 select * into run from public.system_reset_runs where id=p_id for update;
 if found then
  if run.owner_id<>p_owner or run.scope<>p_scope then raise exception 'Reset request does not match.';end if;
  return to_jsonb(run);
 end if;
 perform catalog_private.reset_assert_coverage();
 perform catalog_private.reset_media_paths(p_media_files);
 if p_scope not in ('media','full') and p_media_files<>'[]'::jsonb then raise exception 'Invalid reset upload manifest.' using errcode='22023';end if;
 run:=jsonb_populate_record(null::public.system_reset_runs,catalog_private.system_reset_begin_legacy(p_owner,p_scope,p_id,p_media_files));
 if p_scope='full' then
  foreach path in array catalog_private.reset_media_paths(p_media_files) loop perform public.catalog_media_delete(p_owner,path,false);end loop;
 end if;
 return to_jsonb(run);
end $$;

alter function public.system_reset_plan(uuid,text) set schema catalog_private;
alter function catalog_private.system_reset_plan(uuid,text) rename to system_reset_plan_legacy;
revoke all on function catalog_private.system_reset_plan_legacy(uuid,text) from public,anon,authenticated,service_role;
create function public.system_reset_plan(p_owner uuid,p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan jsonb;
begin
 perform public.system_reset_assert_owner(p_owner);perform catalog_private.reset_assert_coverage();
 plan:=catalog_private.system_reset_plan_legacy(p_owner,p_scope);
 if p_scope in ('orders','commerce','full') then
  if exists(select 1 from public.order_packing_videos where status='uploading') then
   plan:=jsonb_set(plan,'{blockers}',plan->'blockers'||jsonb_build_array(jsonb_build_object('table','order_packing_videos','count',1)));end if;
  if exists(select 1 from public.shipping_order_jobs where state in ('submitting','label_pending')) then
   plan:=jsonb_set(plan,'{blockers}',plan->'blockers'||jsonb_build_array(jsonb_build_object('table','shipping_order_jobs','count',1)));end if;
 end if;
 return plan;
end $$;

create function public.system_reset_cleanup_checkpoint(p_owner uuid,p_id uuid,p_kind text,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare run public.system_reset_runs; captured jsonb; item text; bucket text; done jsonb;
begin
 perform public.system_reset_assert_owner(p_owner);
 if p_kind is null or p_kind<>all(array['documents','support','chat','packing','labels','evidence','media','users'])
  or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100
  or octet_length(p_items::text)>131072 or exists(select 1 from jsonb_array_elements(p_items) i where jsonb_typeof(i)<>'string') then
  raise exception 'Invalid reset cleanup checkpoint.' using errcode='22023';end if;
 select * into run from public.system_reset_runs where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Reset request not found.';end if;
 if run.status='completed' then return jsonb_build_object('id',p_id,'status','completed');end if;
 if run.manifest->>'format' is distinct from '2' then raise exception 'This earlier reset needs operator review.';end if;
 captured:=coalesce(run.manifest->p_kind,'[]');
 bucket:=case p_kind when 'documents' then 'admin-documents' when 'support' then 'support-attachments'
  when 'chat' then 'chat-attachments' when 'packing' then 'order-packing-videos' when 'labels' then 'shipping-labels' when 'evidence' then 'after-sales-evidence' end;
 for item in select distinct value from jsonb_array_elements_text(p_items) loop
  if not exists(select 1 from jsonb_array_elements(captured) i where case when p_kind='media' then i->>'path' else i#>>'{}' end=item) then
   raise exception 'Cleanup does not match this reset.';end if;
  if p_kind='media' then perform public.catalog_media_delete(p_owner,'/uploads/'||item,true);
  elsif p_kind='users' then
   if item=p_owner::text or exists(select 1 from auth.users where id=item::uuid) then raise exception 'Account cleanup is pending.';end if;
  elsif exists(select 1 from storage.objects where bucket_id=bucket and name=item) then raise exception 'Storage cleanup is pending.';end if;
 end loop;
 select coalesce(jsonb_agg(x order by x),'[]') into done from (
  select distinct value x from jsonb_array_elements_text(coalesce(run.cleanup_progress->p_kind,'[]')||p_items)) items;
 update public.system_reset_runs set cleanup_progress=jsonb_set(cleanup_progress,array[p_kind],done) where id=p_id;
 return jsonb_build_object('id',p_id,'status','cleanup_pending');
end $$;

alter function public.system_reset_finish(uuid,uuid) set schema catalog_private;
alter function catalog_private.system_reset_finish(uuid,uuid) rename to system_reset_finish_legacy;
revoke all on function catalog_private.system_reset_finish_legacy(uuid,uuid) from public,anon,authenticated,service_role;
create function public.system_reset_finish(p_owner uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run public.system_reset_runs; kind text; result jsonb;
begin
 perform public.system_reset_assert_owner(p_owner);
 select * into run from public.system_reset_runs where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Reset request not found.';end if;
 if run.status<>'completed' then
  if run.manifest->>'format' is distinct from '2' then raise exception 'This earlier reset needs operator review.';end if;
  foreach kind in array array['documents','support','chat','packing','labels','evidence','media','users'] loop
   if exists(select 1 from jsonb_array_elements(coalesce(run.manifest->kind,'[]')) item
    where not coalesce(run.cleanup_progress->kind,'[]') ? (case when kind='media' then item->>'path' else item#>>'{}' end)) then
    raise exception 'Reset cleanup is still pending.';
   end if;
  end loop;
 end if;
 result:=catalog_private.system_reset_finish_legacy(p_owner,p_id);
 update public.system_reset_runs set cleanup_progress='{}' where id=p_id and cleanup_progress<>'{}';
 return result;
end $$;

-- Explicit service-only entry points. Helpers/old engines cannot be bypassed.
revoke all on function catalog_private.reset_assert_coverage(),catalog_private.reset_media_paths(jsonb),
 catalog_private.reset_media_columns(),catalog_private.reset_media_tables(),catalog_private.reset_media_projection(jsonb,text[]),
 catalog_private.reset_clear_media(uuid,jsonb),catalog_private.reset_manifest(),catalog_private.reset_storage_reference() from public,anon,authenticated,service_role;
revoke all on function public.system_reset_begin(uuid,text,uuid,jsonb),public.system_reset_plan(uuid,text),
 public.system_reset_media_plan(uuid,jsonb,text),public.system_reset_cleanup_checkpoint(uuid,uuid,text,jsonb),public.system_reset_finish(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.system_reset_begin(uuid,text,uuid,jsonb),public.system_reset_plan(uuid,text),
 public.system_reset_media_plan(uuid,jsonb,text),public.system_reset_cleanup_checkpoint(uuid,uuid,text,jsonb),public.system_reset_finish(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
