begin;

alter table public.site_settings
add column if not exists homepage_reviews_enabled boolean not null default true;

alter table public.site_settings
add column if not exists homepage_reviews_view_all_enabled boolean not null default true;

commit;
