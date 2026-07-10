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

create or replace function public.default_admin_permissions () returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'products.view', false,
    'products.add', false,
    'products.edit', false,
    'categories.view', false,
    'categories.add', false,
    'categories.edit', false,
    'brands.view', false,
    'brands.add', false,
    'brands.edit', false,
    'settings.view', false,
    'settings.edit', false
  );
$$;

create table public.admin_users (
  id uuid not null,
  email text not null,
  full_name text null,
  role text not null default 'admin'::text,
  permissions jsonb not null default public.default_admin_permissions (),
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint admin_users_pkey primary key (id),
  constraint admin_users_email_key unique (email),
  constraint admin_users_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint admin_users_role_check check ((role = any (array['owner'::text, 'admin'::text])))
) TABLESPACE pg_default;

create index IF not exists admin_users_role_active_idx on public.admin_users using btree (role, is_active) TABLESPACE pg_default;

create index IF not exists admin_users_created_at_idx on public.admin_users using btree (created_at desc) TABLESPACE pg_default;

create table public.site_settings (
  id uuid not null default gen_random_uuid (),
  key text not null default 'default'::text,
  site_name text not null default 'ELcomputer'::text,
  site_logo_url text null,
  site_background_color text null default '#f3f4f6'::text,
  landing_page_title text null default 'ELcomputer'::text,
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

create table public.site_coupons (
  id uuid not null default gen_random_uuid (),
  code text not null,
  description text null,
  discount_type text not null default 'fixed'::text,
  discount_value numeric (12, 2) not null default 0,
  minimum_order_amount numeric (12, 2) not null default 0,
  usage_limit integer null,
  usage_count integer not null default 0,
  starts_at timestamp with time zone null,
  ends_at timestamp with time zone null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint site_coupons_pkey primary key (id),
  constraint site_coupons_code_key unique (code),
  constraint site_coupons_discount_type_check check ((discount_type = any (array['fixed'::text, 'percentage'::text]))),
  constraint site_coupons_discount_value_check check ((discount_value >= (0)::numeric)),
  constraint site_coupons_minimum_order_amount_check check ((minimum_order_amount >= (0)::numeric)),
  constraint site_coupons_usage_count_check check ((usage_count >= 0)),
  constraint site_coupons_usage_limit_check check (((usage_limit is null) or (usage_limit > 0)))
) TABLESPACE pg_default;

create index IF not exists site_coupons_is_active_idx on public.site_coupons using btree (is_active, code) TABLESPACE pg_default;

create table public.customer_profiles (
  id uuid not null,
  email text not null,
  full_name text null,
  avatar_url text null,
  phone text null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  state text null,
  country text null,
  is_active boolean not null default true,
  wallet_balance numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint customer_profiles_pkey primary key (id),
  constraint customer_profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint customer_profiles_email_key unique (email),
  constraint customer_profiles_wallet_balance_check check ((wallet_balance >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists customer_profiles_is_active_idx on public.customer_profiles using btree (is_active) TABLESPACE pg_default;

create index IF not exists customer_profiles_created_at_idx on public.customer_profiles using btree (created_at desc) TABLESPACE pg_default;

create table public.customer_orders (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  order_number text null,
  status text not null default 'in_progress'::text,
  first_name text not null,
  last_name text null,
  email text null,
  phone text not null,
  street_address text not null,
  city text not null,
  governorate text not null,
  shipping_method text null,
  payment_method text null,
  subtotal_amount numeric (12, 2) not null default 0,
  discount_amount numeric (12, 2) not null default 0,
  coupon_code text null,
  total_amount numeric (12, 2) not null default 0,
  currency text not null default 'EGP'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint customer_orders_pkey primary key (id),
  constraint customer_orders_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint customer_orders_discount_amount_check check ((discount_amount >= (0)::numeric)),
  constraint customer_orders_subtotal_amount_check check ((subtotal_amount >= (0)::numeric)),
  constraint customer_orders_status_check check ((status = any (array['in_progress'::text, 'delivered'::text, 'cancelled'::text]))),
  constraint customer_orders_total_amount_check check ((total_amount >= (0)::numeric))
) TABLESPACE pg_default;

create unique index IF not exists customer_orders_order_number_uidx on public.customer_orders using btree (order_number) TABLESPACE pg_default
where
  (order_number is not null);

create index IF not exists customer_orders_user_status_idx on public.customer_orders using btree (user_id, status) TABLESPACE pg_default;

create index IF not exists customer_orders_user_created_at_idx on public.customer_orders using btree (user_id, created_at desc) TABLESPACE pg_default;

create table public.customer_order_items (
  id uuid not null default gen_random_uuid (),
  order_id uuid not null,
  product_id uuid null,
  product_title text not null,
  product_slug text null,
  image_url text null,
  unit_price numeric (12, 2) not null default 0,
  quantity integer not null default 1,
  line_total numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  constraint customer_order_items_pkey primary key (id),
  constraint customer_order_items_order_id_fkey foreign KEY (order_id) references customer_orders (id) on delete CASCADE,
  constraint customer_order_items_product_id_fkey foreign KEY (product_id) references products (id) on delete set null,
  constraint customer_order_items_line_total_check check ((line_total >= (0)::numeric)),
  constraint customer_order_items_quantity_check check ((quantity > 0)),
  constraint customer_order_items_unit_price_check check ((unit_price >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists customer_order_items_order_id_idx on public.customer_order_items using btree (order_id, created_at) TABLESPACE pg_default;

create or replace function public.handle_new_customer_profile () returns trigger language plpgsql security definer
set
  search_path = public as $$
begin
  insert into public.customer_profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created_create_customer_profile
after insert on auth.users for each row
execute function public.handle_new_customer_profile ();

create or replace function public.is_owner () returns boolean language sql stable as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid ()
      and is_active = true
      and role = 'owner'
  );
$$;

create or replace function public.has_admin_permission (permission_key text) returns boolean language sql stable as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid ()
      and is_active = true
      and (
        role = 'owner'
        or coalesce((permissions ->> permission_key)::boolean, false)
      )
  );
$$;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_specifications enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_hero_banners enable row level security;
alter table public.site_top_bar_messages enable row level security;
alter table public.site_links enable row level security;
alter table public.site_coupons enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;

create policy "Admin users can read their own profile" on public.admin_users for
select
  to authenticated
    using ((auth.uid () = id));

create policy "Public can read published products" on public.products for
select
  to public
    using ((is_published = true));

create policy "Admins can read dashboard products" on public.products for
select
  to authenticated
    using (
      public.has_admin_permission ('products.view')
      or public.has_admin_permission ('products.edit')
    );

create policy "Admins can add products" on public.products for insert to authenticated
with
  check (public.has_admin_permission ('products.add'));

create policy "Admins can edit products" on public.products for
update
  to authenticated
    using (public.has_admin_permission ('products.edit'))
with
  check (public.has_admin_permission ('products.edit'));

create policy "Admins can delete products" on public.products for delete to authenticated using (public.has_admin_permission ('products.edit'));

create policy "Public can read images for published products" on public.product_images for
select
  to public
    using (
      exists (
        select 1
        from public.products
        where products.id = product_images.product_id
          and products.is_published = true
      )
      or public.has_admin_permission ('products.view')
      or public.has_admin_permission ('products.edit')
    );

create policy "Admins can manage product images" on public.product_images for all to authenticated
using (public.has_admin_permission ('products.edit'))
with
  check (public.has_admin_permission ('products.edit'));

create policy "Public can read specifications for published products" on public.product_specifications for
select
  to public
    using (
      exists (
        select 1
        from public.products
        where products.id = product_specifications.product_id
          and products.is_published = true
      )
      or public.has_admin_permission ('products.view')
      or public.has_admin_permission ('products.edit')
    );

create policy "Admins can manage product specifications" on public.product_specifications for all to authenticated
using (public.has_admin_permission ('products.edit'))
with
  check (public.has_admin_permission ('products.edit'));

create policy "Public can read categories" on public.categories for
select
  to public
    using (true);

create policy "Admins can add categories" on public.categories for insert to authenticated
with
  check (public.has_admin_permission ('categories.add'));

create policy "Admins can edit categories" on public.categories for
update
  to authenticated
    using (public.has_admin_permission ('categories.edit'))
with
  check (public.has_admin_permission ('categories.edit'));

create policy "Admins can delete categories" on public.categories for delete to authenticated using (public.has_admin_permission ('categories.edit'));

create policy "Public can read brands" on public.brands for
select
  to public
    using (true);

create policy "Admins can add brands" on public.brands for insert to authenticated
with
  check (public.has_admin_permission ('brands.add'));

create policy "Admins can edit brands" on public.brands for
update
  to authenticated
    using (public.has_admin_permission ('brands.edit'))
with
  check (public.has_admin_permission ('brands.edit'));

create policy "Admins can delete brands" on public.brands for delete to authenticated using (public.has_admin_permission ('brands.edit'));

create policy "Public can read site settings" on public.site_settings for
select
  to public
    using (true);

create policy "Admins can manage site settings" on public.site_settings for all to authenticated
using (public.has_admin_permission ('settings.edit'))
with
  check (public.has_admin_permission ('settings.edit'));

create policy "Public can read hero banners" on public.site_hero_banners for
select
  to public
    using (true);

create policy "Admins can manage hero banners" on public.site_hero_banners for all to authenticated
using (public.has_admin_permission ('settings.edit'))
with
  check (public.has_admin_permission ('settings.edit'));

create policy "Public can read top bar messages" on public.site_top_bar_messages for
select
  to public
    using (true);

create policy "Admins can manage top bar messages" on public.site_top_bar_messages for all to authenticated
using (public.has_admin_permission ('settings.edit'))
with
  check (public.has_admin_permission ('settings.edit'));

create policy "Public can read site links" on public.site_links for
select
  to public
    using (true);

create policy "Admins can manage site links" on public.site_links for all to authenticated
using (public.has_admin_permission ('settings.edit'))
with
  check (public.has_admin_permission ('settings.edit'));

create policy "Admins can manage site coupons" on public.site_coupons for all to authenticated
using (public.has_admin_permission ('settings.edit'))
with
  check (public.has_admin_permission ('settings.edit'));

create policy "Users can read their own customer profile" on public.customer_profiles for
select
  to authenticated
    using ((auth.uid () = id));

create policy "Users can create their own customer profile" on public.customer_profiles for insert to authenticated
with
  check ((auth.uid () = id));

create policy "Users can update their own customer profile" on public.customer_profiles for
update
  to authenticated
    using ((auth.uid () = id))
with
  check ((auth.uid () = id));

create policy "Users can read their own customer orders" on public.customer_orders for
select
  to authenticated
    using ((auth.uid () = user_id));

create policy "Users can read their own customer order items" on public.customer_order_items for
select
  to authenticated
    using (
      exists (
        select 1
        from public.customer_orders
        where customer_orders.id = customer_order_items.order_id
          and customer_orders.user_id = auth.uid ()
      )
    );
