begin;
set local lock_timeout='5s';

-- No business data backfill or new foreign keys. Retain deletion tombstones.
create table catalog_private.media_paths (
  path text primary key,
  state text not null default 'active' check(state in ('active','deleting','deleted')),
  updated_at timestamptz not null default clock_timestamp()
);
alter table catalog_private.media_paths enable row level security;
revoke all on catalog_private.media_paths from public, anon, authenticated, service_role;

-- Decode ASCII URL escapes before matching, including encoded slashes and dots.
create function catalog_private.media_decode(value text) returns text
language plpgsql immutable set search_path='' as $$
declare item text; n integer; result text:=value;
begin
  for item in select distinct m[1] from regexp_matches(value,'%([0-9a-fA-F]{2})','g') m loop
    n:=get_byte(decode(item,'hex'),0);
    if n between 32 and 126 then result:=replace(result,'%'||item,chr(n)); end if;
  end loop;
  return result;
end $$;

create function catalog_private.media_canonical(value text) returns text
language plpgsql immutable set search_path='' as $$
declare part text; parts text[]:=array[]::text[];
begin
  foreach part in array string_to_array(substr(value,10),'/') loop
    if part='' or part='.' then continue; end if;
    if part='..' then
      if cardinality(parts)=0 then return null; end if;
      parts:=parts[1:cardinality(parts)-1];
    else parts:=array_append(parts,part); end if;
  end loop;
  return '/uploads/'||array_to_string(parts,'/');
end $$;

-- All string values cover current URLs, markdown, HTML and nested brand content.
-- Absolute origins are deliberately treated conservatively as references too.
create function catalog_private.media_references(document jsonb) returns setof text
language sql immutable set search_path='' as $$
  with paths as (
    select catalog_private.media_canonical(split_part(split_part(m[1],'?',1),'#',1)) path
    from jsonb_path_query(document,'$.** ? (@.type() == "string")') v,
      lateral regexp_matches(catalog_private.media_decode(v #>> '{}'),
        '(/uploads/[^[:space:]"''<>()[\]{}\\]+)','g') m
  )
  -- The HTTP/filesystem contract caps managed paths; longer text is not media.
  -- Case-insensitive disks can resolve several URL spellings to one file.
  -- Protect those aliases together, conservatively on case-sensitive disks too.
  select distinct lower(path) from paths where path is not null and octet_length(path)<=512
$$;

create function catalog_private.guard_media_references() returns trigger
language plpgsql security definer set search_path='' as $$
declare target text; current_state text;
begin
  for target in select x from catalog_private.media_references(to_jsonb(new)) x where x is not null order by x loop
    insert into catalog_private.media_paths(path) values(target) on conflict(path) do nothing;
    select state into current_state from catalog_private.media_paths where path=target for share;
    if current_state <> 'active' then
      -- Allow unchanged historical snapshots/content; never add a deleted reference.
      if tg_op='INSERT' or not exists(select 1 from catalog_private.media_references(to_jsonb(old)) x where x=target) then
        raise exception using errcode='P0001', message='This image is unavailable. Choose another image.';
      end if;
    end if;
  end loop;
  return new;
end $$;

do $$ declare tab text; begin
  foreach tab in array array['products','product_variants','product_images','product_specifications',
    'categories','brands','site_settings','site_pages','site_hero_banners','site_offer_cards',
    'site_links','site_top_bar_messages','help_articles','customer_order_items'] loop
    execute format('create trigger media_reference_guard before insert or update on public.%I for each row execute function catalog_private.guard_media_references()',tab);
  end loop;
end $$;

create function public.catalog_media_delete(p_admin_id uuid,p_path text,p_finish boolean default false)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor public.admin_users%rowtype; tab text; used boolean; current_state text;
begin
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
  if p_finish and current_state <> 'deleting' then raise exception 'MEDIA_DELETE_NOT_RESERVED'; end if;
  update catalog_private.media_paths set state=case when p_finish then 'deleted' else 'deleting' end,
    updated_at=clock_timestamp() where path=p_path;
  return jsonb_build_object('state',case when p_finish then 'deleted' else 'deleting' end);
end $$;

revoke all on function catalog_private.media_decode(text), catalog_private.media_references(jsonb),
  catalog_private.media_canonical(text), catalog_private.guard_media_references() from public, anon, authenticated, service_role;
revoke all on function public.catalog_media_delete(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.catalog_media_delete(uuid,text,boolean) to service_role;
notify pgrst,'reload schema';
commit;
