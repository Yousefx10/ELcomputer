-- Recovered d6b0934 cache DDL; physical slot is bound at release time. Public VPS image HTTP caching only; no private cache or worker.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.site_settings add column public_image_cache jsonb not null default '{"enabled":true,"maxAge":86400,"version":"1"}'::jsonb
 check(jsonb_typeof(public_image_cache)='object'
  and public_image_cache ?& array['enabled','maxAge','version']
  and public_image_cache-array['enabled','maxAge','version']='{}'::jsonb
  and jsonb_typeof(public_image_cache->'version')='string'
  and jsonb_typeof(public_image_cache->'enabled')='boolean'
  and jsonb_typeof(public_image_cache->'maxAge')='number'
  and (public_image_cache->>'maxAge')::numeric in (0,3600,86400,604800)
  and public_image_cache->>'version' ~ '^[a-zA-Z0-9-]{1,40}$');
notify pgrst,'reload schema';
commit;
