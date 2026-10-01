begin;
-- Optional overrides on existing public content. Existing data and RLS remain intact.
alter table public.site_settings
  add column if not exists seo_site_title text,
  add column if not exists seo_default_description text,
  add column if not exists seo_social_image_url text,
  add column if not exists seo_site_url text;
alter table public.products
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_image_url text;
alter table public.categories
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_image_url text;
alter table public.brands
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_image_url text;
alter table public.site_pages
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_image_url text;
alter table public.site_pages add column if not exists seo_noindex boolean not null default false;
commit;
