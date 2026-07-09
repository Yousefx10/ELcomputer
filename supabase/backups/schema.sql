-- Supabase database schema backup
-- Schema only. No real data here.

create table if not exists public.categories (
  id uuid not null default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamp with time zone null default now(),
  constraint categories_pkey primary key (id),
  constraint categories_slug_key unique (slug)
);

create table if not exists public.products (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text null,
  price numeric not null default 0,
  old_price numeric null,
  image_url text null,
  is_top_seller boolean null default false,
  is_featured boolean null default false,
  created_at timestamp with time zone null default now(),
  category_id uuid null,
  constraint products_pkey primary key (id),
  constraint products_category_id_fkey foreign key (category_id) 
    references public.categories (id) 
    on delete restrict
);