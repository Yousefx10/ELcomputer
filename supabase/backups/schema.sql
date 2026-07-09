-- Supabase database schema backup
-- Schema only. No real data here.

create table public.categories (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text not null,
  created_at timestamp with time zone null default now(),
  constraint categories_pkey primary key (id),
  constraint categories_slug_key unique (slug)
) TABLESPACE pg_default;

create table public.brands (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text not null,
  logo_url text null,
  created_at timestamp with time zone null default now(),
  constraint brands_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists brands_slug_uidx on public.brands using btree (slug) TABLESPACE pg_default;

create table public.products (
  id uuid not null default gen_random_uuid (),
  title text not null,
  description text null,
  price numeric not null default 0,
  old_price numeric null,
  image_url text null,
  is_top_seller boolean null default false,
  is_featured boolean null default false,
  created_at timestamp with time zone null default now(),
  category_id uuid null,
  slug text not null,
  brand_id uuid null,
  long_description text null,
  color_name text null,
  color_hex text null,
  stock_quantity integer not null default 0,
  is_published boolean not null default true,
  sku text null,
  popularity_score integer not null default 0,
  average_rating numeric (3, 2) not null default 0,
  constraint products_pkey primary key (id),
  constraint products_brand_id_fkey foreign KEY (brand_id) references brands (id) on delete set null,
  constraint products_category_id_fkey foreign KEY (category_id) references categories (id) on delete RESTRICT,
  constraint products_average_rating_check check (
    (
      (average_rating >= (0)::numeric)
      and (average_rating <= (5)::numeric)
    )
  ),
  constraint products_old_price_check check (
    (
      (old_price is null)
      or (old_price >= (0)::numeric)
    )
  ),
  constraint products_price_check check ((price >= (0)::numeric)),
  constraint products_popularity_score_check check ((popularity_score >= 0)),
  constraint products_stock_quantity_check check ((stock_quantity >= 0))
) TABLESPACE pg_default;

create unique INDEX IF not exists products_slug_uidx on public.products using btree (slug) TABLESPACE pg_default;

create unique INDEX IF not exists products_sku_uidx on public.products using btree (sku) TABLESPACE pg_default
where
  (sku is not null);

create index IF not exists products_category_id_idx on public.products using btree (category_id) TABLESPACE pg_default;

create index IF not exists products_brand_id_idx on public.products using btree (brand_id) TABLESPACE pg_default;

create index IF not exists products_is_published_idx on public.products using btree (is_published) TABLESPACE pg_default;

create index IF not exists products_popularity_score_idx on public.products using btree (popularity_score desc) TABLESPACE pg_default;

create index IF not exists products_average_rating_idx on public.products using btree (average_rating desc) TABLESPACE pg_default;

create table public.product_specifications (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  label text not null,
  value text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone null default now(),
  constraint product_specifications_pkey primary key (id),
  constraint product_specifications_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists product_specifications_product_id_sort_idx on public.product_specifications using btree (product_id, sort_order) TABLESPACE pg_default;

create table public.product_images (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  image_url text not null,
  alt_text text null,
  sort_order integer not null default 0,
  created_at timestamp with time zone null default now(),
  constraint product_images_pkey primary key (id),
  constraint product_images_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists product_images_product_id_sort_idx on public.product_images using btree (product_id, sort_order) TABLESPACE pg_default;

create table public.site_settings (
  id uuid not null default gen_random_uuid (),
  key text not null default 'default'::text,
  site_name text not null default 'ELcomputer'::text,
  site_logo_url text null,
  hero_enabled boolean not null default true,
  hero_rotation_seconds integer not null default 5,
  top_bar_rotation_seconds integer not null default 3,
  banner_ad_1_enabled boolean not null default true,
  banner_ad_1_image_url text null,
  banner_ad_1_link_url text null,
  banner_ad_2_enabled boolean not null default true,
  banner_ad_2_image_url text null,
  banner_ad_2_link_url text null,
  footer_cta_title text null default 'What are you waiting for?'::text,
  footer_cta_subtitle text null default 'Purchase your fav gear'::text,
  footer_cta_button_label text null default 'Shop Now'::text,
  footer_cta_button_url text null default '/'::text,
  footer_email text null,
  footer_phone text null,
  footer_address text null,
  copyright_text text null default '© 2026 All rights reserved by ELCOMPUTER'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint site_settings_pkey primary key (id),
  constraint site_settings_key_key unique (key),
  constraint site_settings_hero_rotation_seconds_check check ((hero_rotation_seconds >= 1)),
  constraint site_settings_top_bar_rotation_seconds_check check ((top_bar_rotation_seconds >= 1))
) TABLESPACE pg_default;

create table public.site_hero_banners (
  id uuid not null default gen_random_uuid (),
  image_url text not null,
  link_url text null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamp with time zone null default now(),
  constraint site_hero_banners_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists site_hero_banners_sort_idx on public.site_hero_banners using btree (sort_order, created_at) TABLESPACE pg_default;

create table public.site_top_bar_messages (
  id uuid not null default gen_random_uuid (),
  text text not null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamp with time zone null default now(),
  constraint site_top_bar_messages_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists site_top_bar_messages_sort_idx on public.site_top_bar_messages using btree (sort_order, created_at) TABLESPACE pg_default;

create table public.site_links (
  id uuid not null default gen_random_uuid (),
  location text not null,
  section_title text null,
  label text not null,
  url text null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamp with time zone null default now(),
  constraint site_links_pkey primary key (id),
  constraint site_links_location_check check ((location = any (array['header'::text, 'footer'::text])))
) TABLESPACE pg_default;

create index IF not exists site_links_location_sort_idx on public.site_links using btree (location, section_title, sort_order, created_at) TABLESPACE pg_default;
