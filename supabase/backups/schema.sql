-- Supabase database schema backup
-- Schema only. No real data here.

create table public.categories (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text not null,
  image_url text null,
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
  default_supplier_id uuid null,
  primary_warehouse_id uuid null,
  long_description text null,
  color_name text null,
  color_hex text null,
  stock_quantity integer not null default 0,
  cost_price numeric not null default 0,
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
  constraint products_cost_price_check check ((cost_price >= (0)::numeric)),
  constraint products_popularity_score_check check ((popularity_score >= 0)),
  constraint products_stock_quantity_check check ((stock_quantity >= 0))
) TABLESPACE pg_default;

create unique INDEX IF not exists products_slug_uidx on public.products using btree (slug) TABLESPACE pg_default;

create unique INDEX IF not exists products_sku_uidx on public.products using btree (sku) TABLESPACE pg_default
where
  (sku is not null);

create index IF not exists products_category_id_idx on public.products using btree (category_id) TABLESPACE pg_default;

create index IF not exists products_brand_id_idx on public.products using btree (brand_id) TABLESPACE pg_default;

create index IF not exists products_default_supplier_id_idx on public.products using btree (default_supplier_id) TABLESPACE pg_default;

create index IF not exists products_primary_warehouse_id_idx on public.products using btree (primary_warehouse_id) TABLESPACE pg_default;

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
    'dashboard.view', false,
    'dashboard.analysis', false,
    'dashboard.orders', false,
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
    'settings.edit', false,
    'settings.coupons', false,
    'users.view', false,
    'hr.view', false,
    'hr.edit', false,
    'treasury.view', false,
    'treasury.edit', false
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

create table public.admin_activity_logs (
  id uuid not null default gen_random_uuid (),
  admin_user_id uuid null,
  author_name text not null,
  author_email text not null,
  author_role text not null default 'admin'::text,
  action_key text null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  constraint admin_activity_logs_pkey primary key (id),
  constraint admin_activity_logs_admin_user_id_fkey foreign KEY (admin_user_id) references admin_users (id) on delete set null,
  constraint admin_activity_logs_author_role_check check ((author_role = any (array['owner'::text, 'admin'::text])))
) TABLESPACE pg_default;

create index IF not exists admin_activity_logs_created_at_idx on public.admin_activity_logs using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists admin_activity_logs_author_idx on public.admin_activity_logs using btree (admin_user_id, created_at desc) TABLESPACE pg_default;

create index IF not exists admin_activity_logs_author_email_idx on public.admin_activity_logs using btree (author_email, created_at desc) TABLESPACE pg_default;

create table public.site_settings (
  id uuid not null default gen_random_uuid (),
  key text not null default 'default'::text,
  site_name text not null default 'ELcomputer'::text,
  site_logo_url text null,
  site_background_color text null default '#f3f4f6'::text,
  landing_page_title text null default 'ELcomputer'::text,
  allow_out_of_stock_purchases boolean not null default false,
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

create table public.site_offer_cards (
  id uuid not null default gen_random_uuid (),
  eyebrow_text text null,
  title text not null,
  image_url text not null,
  target_type text not null default 'search'::text,
  search_query text null,
  product_slug text null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamp with time zone null default now(),
  constraint site_offer_cards_pkey primary key (id),
  constraint site_offer_cards_target_type_check check ((target_type = any (array['search'::text, 'product'::text])))
) TABLESPACE pg_default;

create index IF not exists site_offer_cards_sort_idx on public.site_offer_cards using btree (sort_order, created_at) TABLESPACE pg_default;

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
  status text not null default 'pending_payment'::text,
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
  constraint customer_orders_status_check check (
    (
      status = any (
        array[
          'pending_payment'::text,
          'processing'::text,
          'being_shipped'::text,
          'out_for_delivery'::text,
          'on_hold'::text,
          'completed'::text,
          'refunded'::text,
          'cancelled'::text,
          'in_progress'::text,
          'delivered'::text
        ]
      )
    )
  ),
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
alter table public.admin_activity_logs enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_specifications enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_hero_banners enable row level security;
alter table public.site_top_bar_messages enable row level security;
alter table public.site_offer_cards enable row level security;
alter table public.site_links enable row level security;
alter table public.site_coupons enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;

create policy "Admin users can read their own profile" on public.admin_users for
select
  to authenticated
    using ((auth.uid () = id));

create policy "Admins can read activity logs" on public.admin_activity_logs for
select
  to authenticated
    using (public.has_admin_permission ('settings.view'));

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

create policy "Public can read offer cards" on public.site_offer_cards for
select
  to public
    using (true);

create policy "Admins can manage offer cards" on public.site_offer_cards for all to authenticated
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

create table public.commerce_crm_accounts (
  id uuid not null default gen_random_uuid (),
  account_type text not null,
  entity_type text not null default 'company'::text,
  name text not null,
  code text null,
  email text null,
  phone text null,
  tax_number text null,
  address_line_1 text null,
  city text null,
  country text null,
  notes text null,
  primary_contact_name text null,
  primary_contact_role text null,
  primary_contact_email text null,
  primary_contact_phone text null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_crm_accounts_pkey primary key (id),
  constraint commerce_crm_accounts_account_type_check check ((account_type = any (array['supplier'::text, 'customer'::text]))),
  constraint commerce_crm_accounts_entity_type_check check ((entity_type = any (array['company'::text, 'person'::text])))
) TABLESPACE pg_default;

create unique index IF not exists commerce_crm_accounts_code_uidx on public.commerce_crm_accounts using btree (code) TABLESPACE pg_default
where
  (code is not null);

create index IF not exists commerce_crm_accounts_type_name_idx on public.commerce_crm_accounts using btree (account_type, name) TABLESPACE pg_default;

create table public.commerce_shipping_companies (
  id uuid not null default gen_random_uuid (),
  name text not null,
  code text null,
  shipping_cost numeric (12, 2) not null default 0,
  return_cost numeric (12, 2) not null default 0,
  client_shipping_price numeric (12, 2) not null default 0,
  notes text null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_shipping_companies_pkey primary key (id),
  constraint commerce_shipping_companies_shipping_cost_check check ((shipping_cost >= (0)::numeric)),
  constraint commerce_shipping_companies_return_cost_check check ((return_cost >= (0)::numeric)),
  constraint commerce_shipping_companies_client_shipping_price_check check ((client_shipping_price >= (0)::numeric))
) TABLESPACE pg_default;

create unique index IF not exists commerce_shipping_companies_code_uidx on public.commerce_shipping_companies using btree (code) TABLESPACE pg_default
where
  (code is not null);

create index IF not exists commerce_shipping_companies_active_name_idx on public.commerce_shipping_companies using btree (is_active, name) TABLESPACE pg_default;

create table public.commerce_warehouses (
  id uuid not null default gen_random_uuid (),
  name text not null,
  code text null,
  address_line_1 text null,
  city text null,
  country text null,
  contact_name text null,
  contact_phone text null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_warehouses_pkey primary key (id)
) TABLESPACE pg_default;

create unique index IF not exists commerce_warehouses_code_uidx on public.commerce_warehouses using btree (code) TABLESPACE pg_default
where
  (code is not null);

create index IF not exists commerce_warehouses_active_name_idx on public.commerce_warehouses using btree (is_active, name) TABLESPACE pg_default;

create table public.commerce_warehouse_inventory (
  id uuid not null default gen_random_uuid (),
  warehouse_id uuid not null,
  product_id uuid not null,
  quantity integer not null default 0,
  average_cost numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_warehouse_inventory_pkey primary key (id),
  constraint commerce_warehouse_inventory_warehouse_id_fkey foreign KEY (warehouse_id) references commerce_warehouses (id) on delete CASCADE,
  constraint commerce_warehouse_inventory_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint commerce_warehouse_inventory_quantity_check check ((quantity >= 0)),
  constraint commerce_warehouse_inventory_average_cost_check check ((average_cost >= (0)::numeric)),
  constraint commerce_warehouse_inventory_warehouse_product_key unique (warehouse_id, product_id)
) TABLESPACE pg_default;

create index IF not exists commerce_warehouse_inventory_product_idx on public.commerce_warehouse_inventory using btree (product_id, updated_at desc) TABLESPACE pg_default;

create table public.commerce_inventory_movements (
  id uuid not null default gen_random_uuid (),
  warehouse_id uuid not null,
  product_id uuid not null,
  movement_type text not null,
  reference_type text null,
  reference_id uuid null,
  quantity_change integer not null,
  quantity_after integer not null,
  unit_cost numeric (12, 2) null,
  notes text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint commerce_inventory_movements_pkey primary key (id),
  constraint commerce_inventory_movements_warehouse_id_fkey foreign KEY (warehouse_id) references commerce_warehouses (id) on delete CASCADE,
  constraint commerce_inventory_movements_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint commerce_inventory_movements_created_by_fkey foreign KEY (created_by) references admin_users (id) on delete set null,
  constraint commerce_inventory_movements_movement_type_check check ((movement_type = any (array['procurement'::text, 'sale_out'::text, 'transfer_in'::text, 'transfer_out'::text, 'return_in'::text, 'adjustment'::text]))),
  constraint commerce_inventory_movements_reference_type_check check (((reference_type is null) or (reference_type = any (array['procurement_order'::text, 'sales_order'::text, 'warehouse_transfer'::text, 'order_return'::text, 'manual'::text]))))
) TABLESPACE pg_default;

create index IF not exists commerce_inventory_movements_warehouse_created_idx on public.commerce_inventory_movements using btree (warehouse_id, created_at desc) TABLESPACE pg_default;

create index IF not exists commerce_inventory_movements_product_created_idx on public.commerce_inventory_movements using btree (product_id, created_at desc) TABLESPACE pg_default;

create table public.commerce_procurement_orders (
  id uuid not null default gen_random_uuid (),
  supplier_id uuid not null,
  warehouse_id uuid not null,
  invoice_number text null,
  notes text null,
  total_cost numeric (12, 2) not null default 0,
  paid_amount numeric (12, 2) not null default 0,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_procurement_orders_pkey primary key (id),
  constraint commerce_procurement_orders_supplier_id_fkey foreign KEY (supplier_id) references commerce_crm_accounts (id) on delete RESTRICT,
  constraint commerce_procurement_orders_warehouse_id_fkey foreign KEY (warehouse_id) references commerce_warehouses (id) on delete RESTRICT,
  constraint commerce_procurement_orders_created_by_fkey foreign KEY (created_by) references admin_users (id) on delete set null,
  constraint commerce_procurement_orders_total_cost_check check ((total_cost >= (0)::numeric)),
  constraint commerce_procurement_orders_paid_amount_check check (((paid_amount >= (0)::numeric) and (paid_amount <= total_cost)))
) TABLESPACE pg_default;

create index IF not exists commerce_procurement_orders_created_at_idx on public.commerce_procurement_orders using btree (created_at desc) TABLESPACE pg_default;

create table public.commerce_procurement_items (
  id uuid not null default gen_random_uuid (),
  procurement_order_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  unit_cost numeric (12, 2) not null default 0,
  line_total numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  constraint commerce_procurement_items_pkey primary key (id),
  constraint commerce_procurement_items_procurement_order_id_fkey foreign KEY (procurement_order_id) references commerce_procurement_orders (id) on delete CASCADE,
  constraint commerce_procurement_items_product_id_fkey foreign KEY (product_id) references products (id) on delete RESTRICT,
  constraint commerce_procurement_items_quantity_check check ((quantity > 0)),
  constraint commerce_procurement_items_unit_cost_check check ((unit_cost >= (0)::numeric)),
  constraint commerce_procurement_items_line_total_check check ((line_total >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists commerce_procurement_items_order_idx on public.commerce_procurement_items using btree (procurement_order_id, created_at) TABLESPACE pg_default;

create table public.commerce_sales_orders (
  id uuid not null default gen_random_uuid (),
  customer_id uuid not null,
  warehouse_id uuid not null,
  order_number text null,
  notes text null,
  total_amount numeric (12, 2) not null default 0,
  paid_amount numeric (12, 2) not null default 0,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_sales_orders_pkey primary key (id),
  constraint commerce_sales_orders_customer_id_fkey foreign KEY (customer_id) references commerce_crm_accounts (id) on delete RESTRICT,
  constraint commerce_sales_orders_warehouse_id_fkey foreign KEY (warehouse_id) references commerce_warehouses (id) on delete RESTRICT,
  constraint commerce_sales_orders_created_by_fkey foreign KEY (created_by) references admin_users (id) on delete set null,
  constraint commerce_sales_orders_total_amount_check check ((total_amount >= (0)::numeric)),
  constraint commerce_sales_orders_paid_amount_check check (((paid_amount >= (0)::numeric) and (paid_amount <= total_amount)))
) TABLESPACE pg_default;

create unique index IF not exists commerce_sales_orders_order_number_uidx on public.commerce_sales_orders using btree (order_number) TABLESPACE pg_default
where
  (order_number is not null);

create index IF not exists commerce_sales_orders_customer_created_idx on public.commerce_sales_orders using btree (customer_id, created_at desc) TABLESPACE pg_default;

create table public.commerce_sales_items (
  id uuid not null default gen_random_uuid (),
  sales_order_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  unit_price numeric (12, 2) not null default 0,
  line_total numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  constraint commerce_sales_items_pkey primary key (id),
  constraint commerce_sales_items_sales_order_id_fkey foreign KEY (sales_order_id) references commerce_sales_orders (id) on delete CASCADE,
  constraint commerce_sales_items_product_id_fkey foreign KEY (product_id) references products (id) on delete RESTRICT,
  constraint commerce_sales_items_quantity_check check ((quantity > 0)),
  constraint commerce_sales_items_unit_price_check check ((unit_price >= (0)::numeric)),
  constraint commerce_sales_items_line_total_check check ((line_total >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists commerce_sales_items_order_idx on public.commerce_sales_items using btree (sales_order_id, created_at) TABLESPACE pg_default;

create table public.commerce_warehouse_transfers (
  id uuid not null default gen_random_uuid (),
  from_warehouse_id uuid not null,
  to_warehouse_id uuid not null,
  reference_number text null,
  notes text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_warehouse_transfers_pkey primary key (id),
  constraint commerce_warehouse_transfers_from_warehouse_id_fkey foreign KEY (from_warehouse_id) references commerce_warehouses (id) on delete RESTRICT,
  constraint commerce_warehouse_transfers_to_warehouse_id_fkey foreign KEY (to_warehouse_id) references commerce_warehouses (id) on delete RESTRICT,
  constraint commerce_warehouse_transfers_created_by_fkey foreign KEY (created_by) references admin_users (id) on delete set null,
  constraint commerce_warehouse_transfers_distinct_warehouses_check check ((from_warehouse_id <> to_warehouse_id))
) TABLESPACE pg_default;

create index IF not exists commerce_warehouse_transfers_created_at_idx on public.commerce_warehouse_transfers using btree (created_at desc) TABLESPACE pg_default;

create table public.commerce_warehouse_transfer_items (
  id uuid not null default gen_random_uuid (),
  transfer_id uuid not null,
  product_id uuid not null,
  quantity integer not null,
  created_at timestamp with time zone null default now(),
  constraint commerce_warehouse_transfer_items_pkey primary key (id),
  constraint commerce_warehouse_transfer_items_transfer_id_fkey foreign KEY (transfer_id) references commerce_warehouse_transfers (id) on delete CASCADE,
  constraint commerce_warehouse_transfer_items_product_id_fkey foreign KEY (product_id) references products (id) on delete RESTRICT,
  constraint commerce_warehouse_transfer_items_quantity_check check ((quantity > 0))
) TABLESPACE pg_default;

create index IF not exists commerce_warehouse_transfer_items_transfer_idx on public.commerce_warehouse_transfer_items using btree (transfer_id, created_at) TABLESPACE pg_default;

create table public.commerce_order_returns (
  id uuid not null default gen_random_uuid (),
  order_id uuid not null,
  warehouse_id uuid not null,
  reason text null,
  notes text null,
  total_items integer not null default 0,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint commerce_order_returns_pkey primary key (id),
  constraint commerce_order_returns_order_id_fkey foreign KEY (order_id) references customer_orders (id) on delete RESTRICT,
  constraint commerce_order_returns_warehouse_id_fkey foreign KEY (warehouse_id) references commerce_warehouses (id) on delete RESTRICT,
  constraint commerce_order_returns_created_by_fkey foreign KEY (created_by) references admin_users (id) on delete set null,
  constraint commerce_order_returns_total_items_check check ((total_items >= 0))
) TABLESPACE pg_default;

create index IF not exists commerce_order_returns_order_idx on public.commerce_order_returns using btree (order_id, created_at desc) TABLESPACE pg_default;

create table public.commerce_order_return_items (
  id uuid not null default gen_random_uuid (),
  order_return_id uuid not null,
  order_item_id uuid null,
  product_id uuid null,
  quantity integer not null,
  unit_price numeric (12, 2) not null default 0,
  created_at timestamp with time zone null default now(),
  constraint commerce_order_return_items_pkey primary key (id),
  constraint commerce_order_return_items_order_return_id_fkey foreign KEY (order_return_id) references commerce_order_returns (id) on delete CASCADE,
  constraint commerce_order_return_items_order_item_id_fkey foreign KEY (order_item_id) references customer_order_items (id) on delete set null,
  constraint commerce_order_return_items_product_id_fkey foreign KEY (product_id) references products (id) on delete set null,
  constraint commerce_order_return_items_quantity_check check ((quantity > 0)),
  constraint commerce_order_return_items_unit_price_check check ((unit_price >= (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists commerce_order_return_items_return_idx on public.commerce_order_return_items using btree (order_return_id, created_at) TABLESPACE pg_default;

alter table public.products
add constraint products_default_supplier_id_fkey foreign KEY (default_supplier_id) references commerce_crm_accounts (id) on delete set null;

alter table public.products
add constraint products_primary_warehouse_id_fkey foreign KEY (primary_warehouse_id) references commerce_warehouses (id) on delete set null;

create or replace function public.is_active_admin () returns boolean language sql stable as $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid ()
      and is_active = true
  );
$$;

create or replace function public.commerce_create_procurement_order (
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_invoice_number text,
  p_notes text,
  p_paid_amount numeric,
  p_items jsonb
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_procurement_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_cost numeric (12, 2);
  v_line_total numeric (12, 2);
  v_total_cost numeric (12, 2) := 0;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_inventory_exists boolean := false;
  v_next_product_stock integer;
  v_next_product_cost numeric (12, 2);
  v_next_inventory_quantity integer;
  v_next_inventory_average_cost numeric (12, 2);
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_supplier_id is null or not exists (
    select 1
    from public.commerce_crm_accounts
    where id = p_supplier_id
      and account_type = 'supplier'
      and is_active = true
  ) then
    raise exception 'A valid supplier is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one procurement item is required.';
  end if;

  if coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount cannot be negative.';
  end if;

  insert into public.commerce_procurement_orders (
    supplier_id,
    warehouse_id,
    invoice_number,
    notes,
    total_cost,
    created_by
  )
  values (
    p_supplier_id,
    p_warehouse_id,
    nullif(trim(p_invoice_number), ''),
    nullif(trim(p_notes), ''),
    0,
    auth.uid ()
  )
  returning id into v_procurement_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_cost := round(coalesce((v_item ->> 'unit_cost')::numeric, 0), 2);

    if v_product_id is null or v_quantity <= 0 or v_unit_cost < 0 then
      raise exception 'Every procurement line requires a valid product, quantity, and cost.';
    end if;

    select *
    into v_product_record
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    select *
    into v_inventory_record
    from public.commerce_warehouse_inventory
    where warehouse_id = p_warehouse_id
      and product_id = v_product_id
    for update;

    v_inventory_exists := found;

    v_line_total := round((v_quantity * v_unit_cost)::numeric, 2);
    v_total_cost := round((v_total_cost + v_line_total)::numeric, 2);
    v_next_product_stock := coalesce(v_product_record.stock_quantity, 0) + v_quantity;

    v_next_product_cost := case
      when v_next_product_stock > 0 then round((
        (
          coalesce(v_product_record.cost_price, 0) * greatest(coalesce(v_product_record.stock_quantity, 0), 0)
        ) + (v_unit_cost * v_quantity)
      ) / v_next_product_stock, 2)
      else v_unit_cost
    end;

    update public.products
    set
      stock_quantity = v_next_product_stock,
      cost_price = v_next_product_cost
    where id = v_product_id;

    if v_inventory_exists then
      v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) + v_quantity;
      v_next_inventory_average_cost := case
        when v_next_inventory_quantity > 0 then round((
          (
            coalesce(v_inventory_record.average_cost, 0) * greatest(coalesce(v_inventory_record.quantity, 0), 0)
          ) + (v_unit_cost * v_quantity)
        ) / v_next_inventory_quantity, 2)
        else v_unit_cost
      end;

      update public.commerce_warehouse_inventory
      set
        quantity = v_next_inventory_quantity,
        average_cost = v_next_inventory_average_cost,
        updated_at = now()
      where id = v_inventory_record.id;
    else
      v_next_inventory_quantity := v_quantity;
      v_next_inventory_average_cost := v_unit_cost;

      insert into public.commerce_warehouse_inventory (
        warehouse_id,
        product_id,
        quantity,
        average_cost
      )
      values (
        p_warehouse_id,
        v_product_id,
        v_next_inventory_quantity,
        v_next_inventory_average_cost
      );
    end if;

    insert into public.commerce_procurement_items (
      procurement_order_id,
      product_id,
      quantity,
      unit_cost,
      line_total
    )
    values (
      v_procurement_id,
      v_product_id,
      v_quantity,
      v_unit_cost,
      v_line_total
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_warehouse_id,
      v_product_id,
      'procurement',
      'procurement_order',
      v_procurement_id,
      v_quantity,
      v_next_inventory_quantity,
      v_unit_cost,
      nullif(trim(p_notes), ''),
      auth.uid ()
    );
  end loop;

  if round(coalesce(p_paid_amount, 0), 2) > v_total_cost then
    raise exception 'Paid amount cannot be greater than the procurement total.';
  end if;

  update public.commerce_procurement_orders
  set
    total_cost = v_total_cost,
    paid_amount = round(coalesce(p_paid_amount, 0), 2),
    updated_at = now()
  where id = v_procurement_id;

  return v_procurement_id;
end;
$$;

create or replace function public.commerce_create_sales_order (
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_order_number text,
  p_notes text,
  p_paid_amount numeric,
  p_items jsonb
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_sales_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric (12, 2);
  v_line_total numeric (12, 2);
  v_total_amount numeric (12, 2) := 0;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_next_product_stock integer;
  v_next_inventory_quantity integer;
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_customer_id is null or not exists (
    select 1
    from public.commerce_crm_accounts
    where id = p_customer_id
      and account_type = 'customer'
      and is_active = true
  ) then
    raise exception 'A valid CRM customer is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one sales item is required.';
  end if;

  if coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount cannot be negative.';
  end if;

  insert into public.commerce_sales_orders (
    customer_id,
    warehouse_id,
    order_number,
    notes,
    total_amount,
    paid_amount,
    created_by
  )
  values (
    p_customer_id,
    p_warehouse_id,
    nullif(trim(p_order_number), ''),
    nullif(trim(p_notes), ''),
    0,
    0,
    auth.uid ()
  )
  returning id into v_sales_order_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_price := round(coalesce((v_item ->> 'unit_price')::numeric, 0), 2);

    if v_product_id is null or v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Every sales line requires a valid product, quantity, and price.';
    end if;

    select *
    into v_product_record
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    select *
    into v_inventory_record
    from public.commerce_warehouse_inventory
    where warehouse_id = p_warehouse_id
      and product_id = v_product_id
    for update;

    if not found or coalesce(v_inventory_record.quantity, 0) < v_quantity then
      raise exception 'Insufficient warehouse stock for %.', v_product_record.title;
    end if;

    if coalesce(v_product_record.stock_quantity, 0) < v_quantity then
      raise exception 'Insufficient product stock for %.', v_product_record.title;
    end if;

    v_line_total := round((v_quantity * v_unit_price)::numeric, 2);
    v_total_amount := round((v_total_amount + v_line_total)::numeric, 2);
    v_next_product_stock := coalesce(v_product_record.stock_quantity, 0) - v_quantity;
    v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) - v_quantity;

    update public.products
    set stock_quantity = v_next_product_stock
    where id = v_product_id;

    update public.commerce_warehouse_inventory
    set
      quantity = v_next_inventory_quantity,
      updated_at = now()
    where id = v_inventory_record.id;

    insert into public.commerce_sales_items (
      sales_order_id,
      product_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_sales_order_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_line_total
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_warehouse_id,
      v_product_id,
      'sale_out',
      'sales_order',
      v_sales_order_id,
      -v_quantity,
      v_next_inventory_quantity,
      coalesce(v_inventory_record.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );
  end loop;

  if round(coalesce(p_paid_amount, 0), 2) > v_total_amount then
    raise exception 'Paid amount cannot be greater than the sales total.';
  end if;

  update public.commerce_sales_orders
  set
    total_amount = v_total_amount,
    paid_amount = round(coalesce(p_paid_amount, 0), 2),
    updated_at = now()
  where id = v_sales_order_id;

  return v_sales_order_id;
end;
$$;

create or replace function public.commerce_get_crm_account_summary (
  p_account_id uuid
) returns jsonb language plpgsql security definer stable
set
  search_path = public as $$
declare
  v_account_type text;
  v_order_count bigint := 0;
  v_total_amount numeric (12, 2) := 0;
  v_paid_amount numeric (12, 2) := 0;
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  select account_type
  into v_account_type
  from public.commerce_crm_accounts
  where id = p_account_id;

  if not found then
    raise exception 'CRM account not found.';
  end if;

  if v_account_type = 'supplier' then
    select
      count(*),
      coalesce(sum(total_cost), 0),
      coalesce(sum(paid_amount), 0)
    into
      v_order_count,
      v_total_amount,
      v_paid_amount
    from public.commerce_procurement_orders
    where supplier_id = p_account_id;
  else
    select
      count(*),
      coalesce(sum(total_amount), 0),
      coalesce(sum(paid_amount), 0)
    into
      v_order_count,
      v_total_amount,
      v_paid_amount
    from public.commerce_sales_orders
    where customer_id = p_account_id;
  end if;

  return jsonb_build_object(
    'order_count', v_order_count,
    'total_amount', v_total_amount,
    'paid_amount', v_paid_amount,
    'settlement_due', greatest(v_total_amount - v_paid_amount, 0)
  );
end;
$$;

create or replace function public.commerce_transfer_inventory (
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_reference_number text,
  p_notes text,
  p_items jsonb
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_transfer_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_source_inventory public.commerce_warehouse_inventory%rowtype;
  v_target_inventory public.commerce_warehouse_inventory%rowtype;
  v_target_next_quantity integer;
  v_target_next_average_cost numeric (12, 2);
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_from_warehouse_id is null or p_to_warehouse_id is null or p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Two different warehouses are required.';
  end if;

  if not exists (
    select 1
    from public.commerce_warehouses
    where id = p_from_warehouse_id
      and is_active = true
  ) then
    raise exception 'The source warehouse is not valid.';
  end if;

  if not exists (
    select 1
    from public.commerce_warehouses
    where id = p_to_warehouse_id
      and is_active = true
  ) then
    raise exception 'The destination warehouse is not valid.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one transfer item is required.';
  end if;

  insert into public.commerce_warehouse_transfers (
    from_warehouse_id,
    to_warehouse_id,
    reference_number,
    notes,
    created_by
  )
  values (
    p_from_warehouse_id,
    p_to_warehouse_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    auth.uid ()
  )
  returning id into v_transfer_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'Every transfer line requires a valid product and quantity.';
    end if;

    select *
    into v_source_inventory
    from public.commerce_warehouse_inventory
    where warehouse_id = p_from_warehouse_id
      and product_id = v_product_id
    for update;

    if not found or coalesce(v_source_inventory.quantity, 0) < v_quantity then
      raise exception 'The source warehouse does not have enough stock for one of the selected products.';
    end if;

    update public.commerce_warehouse_inventory
    set
      quantity = quantity - v_quantity,
      updated_at = now()
    where id = v_source_inventory.id
    returning * into v_source_inventory;

    select *
    into v_target_inventory
    from public.commerce_warehouse_inventory
    where warehouse_id = p_to_warehouse_id
      and product_id = v_product_id
    for update;

    if found then
      v_target_next_quantity := coalesce(v_target_inventory.quantity, 0) + v_quantity;
      v_target_next_average_cost := case
        when v_target_next_quantity > 0 then round((
          (
            coalesce(v_target_inventory.average_cost, 0) * greatest(coalesce(v_target_inventory.quantity, 0), 0)
          ) + (coalesce(v_source_inventory.average_cost, 0) * v_quantity)
        ) / v_target_next_quantity, 2)
        else coalesce(v_source_inventory.average_cost, 0)
      end;

      update public.commerce_warehouse_inventory
      set
        quantity = v_target_next_quantity,
        average_cost = v_target_next_average_cost,
        updated_at = now()
      where id = v_target_inventory.id
      returning * into v_target_inventory;
    else
      insert into public.commerce_warehouse_inventory (
        warehouse_id,
        product_id,
        quantity,
        average_cost
      )
      values (
        p_to_warehouse_id,
        v_product_id,
        v_quantity,
        coalesce(v_source_inventory.average_cost, 0)
      )
      returning * into v_target_inventory;
    end if;

    insert into public.commerce_warehouse_transfer_items (
      transfer_id,
      product_id,
      quantity
    )
    values (
      v_transfer_id,
      v_product_id,
      v_quantity
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_from_warehouse_id,
      v_product_id,
      'transfer_out',
      'warehouse_transfer',
      v_transfer_id,
      -v_quantity,
      v_source_inventory.quantity,
      coalesce(v_source_inventory.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_to_warehouse_id,
      v_product_id,
      'transfer_in',
      'warehouse_transfer',
      v_transfer_id,
      v_quantity,
      v_target_inventory.quantity,
      coalesce(v_target_inventory.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );
  end loop;

  return v_transfer_id;
end;
$$;

create or replace function public.commerce_create_order_return (
  p_order_id uuid,
  p_warehouse_id uuid,
  p_reason text,
  p_notes text,
  p_items jsonb
) returns uuid language plpgsql security definer
set
  search_path = public as $$
declare
  v_return_id uuid;
  v_item jsonb;
  v_order_item_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_total_items integer := 0;
  v_previously_returned integer;
  v_order_item public.customer_order_items%rowtype;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_next_inventory_quantity integer;
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_order_id is null or not exists (
    select 1
    from public.customer_orders
    where id = p_order_id
  ) then
    raise exception 'A valid customer order is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one returned item is required.';
  end if;

  insert into public.commerce_order_returns (
    order_id,
    warehouse_id,
    reason,
    notes,
    total_items,
    created_by
  )
  values (
    p_order_id,
    p_warehouse_id,
    nullif(trim(p_reason), ''),
    nullif(trim(p_notes), ''),
    0,
    auth.uid ()
  )
  returning id into v_return_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_order_item_id := nullif(v_item ->> 'order_item_id', '')::uuid;
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_order_item_id is null or v_quantity <= 0 then
      raise exception 'Every return line requires a valid order item and quantity.';
    end if;

    select *
    into v_order_item
    from public.customer_order_items
    where id = v_order_item_id
      and order_id = p_order_id
    for update;

    if not found then
      raise exception 'One of the selected order items is not valid.';
    end if;

    select coalesce(sum(ri.quantity), 0)
    into v_previously_returned
    from public.commerce_order_return_items ri
    join public.commerce_order_returns r on r.id = ri.order_return_id
    where r.order_id = p_order_id
      and ri.order_item_id = v_order_item_id;

    if (v_previously_returned + v_quantity) > coalesce(v_order_item.quantity, 0) then
      raise exception 'Returned quantity exceeds the remaining order quantity for one of the items.';
    end if;

    insert into public.commerce_order_return_items (
      order_return_id,
      order_item_id,
      product_id,
      quantity,
      unit_price
    )
    values (
      v_return_id,
      v_order_item_id,
      coalesce(v_product_id, v_order_item.product_id),
      v_quantity,
      coalesce(v_order_item.unit_price, 0)
    );

    v_total_items := v_total_items + v_quantity;

    if coalesce(v_product_id, v_order_item.product_id) is not null then
      select *
      into v_product_record
      from public.products
      where id = coalesce(v_product_id, v_order_item.product_id)
      for update;

      if found then
        update public.products
        set stock_quantity = stock_quantity + v_quantity
        where id = v_product_record.id;

        select *
        into v_inventory_record
        from public.commerce_warehouse_inventory
        where warehouse_id = p_warehouse_id
          and product_id = v_product_record.id
        for update;

        if found then
          v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) + v_quantity;

          update public.commerce_warehouse_inventory
          set
            quantity = v_next_inventory_quantity,
            updated_at = now()
          where id = v_inventory_record.id;
        else
          v_next_inventory_quantity := v_quantity;

          insert into public.commerce_warehouse_inventory (
            warehouse_id,
            product_id,
            quantity,
            average_cost
          )
          values (
            p_warehouse_id,
            v_product_record.id,
            v_quantity,
            coalesce(v_product_record.cost_price, 0)
          );
        end if;

        insert into public.commerce_inventory_movements (
          warehouse_id,
          product_id,
          movement_type,
          reference_type,
          reference_id,
          quantity_change,
          quantity_after,
          unit_cost,
          notes,
          created_by
        )
        values (
          p_warehouse_id,
          v_product_record.id,
          'return_in',
          'order_return',
          v_return_id,
          v_quantity,
          v_next_inventory_quantity,
          coalesce(v_product_record.cost_price, 0),
          nullif(trim(p_notes), ''),
          auth.uid ()
        );
      end if;
    end if;
  end loop;

  update public.commerce_order_returns
  set
    total_items = v_total_items,
    updated_at = now()
  where id = v_return_id;

  return v_return_id;
end;
$$;

alter table public.commerce_crm_accounts enable row level security;
alter table public.commerce_shipping_companies enable row level security;
alter table public.commerce_warehouses enable row level security;
alter table public.commerce_warehouse_inventory enable row level security;
alter table public.commerce_inventory_movements enable row level security;
alter table public.commerce_procurement_orders enable row level security;
alter table public.commerce_procurement_items enable row level security;
alter table public.commerce_sales_orders enable row level security;
alter table public.commerce_sales_items enable row level security;
alter table public.commerce_warehouse_transfers enable row level security;
alter table public.commerce_warehouse_transfer_items enable row level security;
alter table public.commerce_order_returns enable row level security;
alter table public.commerce_order_return_items enable row level security;

create policy "Admins can manage CRM accounts" on public.commerce_crm_accounts for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage shipping companies" on public.commerce_shipping_companies for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage warehouses" on public.commerce_warehouses for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage warehouse inventory" on public.commerce_warehouse_inventory for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can read inventory movements" on public.commerce_inventory_movements for
select
  to authenticated
    using (public.is_active_admin ());

create policy "Admins can manage procurement orders" on public.commerce_procurement_orders for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage procurement items" on public.commerce_procurement_items for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage sales orders" on public.commerce_sales_orders for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage sales items" on public.commerce_sales_items for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage warehouse transfers" on public.commerce_warehouse_transfers for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage warehouse transfer items" on public.commerce_warehouse_transfer_items for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage order returns" on public.commerce_order_returns for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create policy "Admins can manage order return items" on public.commerce_order_return_items for all to authenticated
using (public.is_active_admin ())
with
  check (public.is_active_admin ());

create table public.hr_employees (
  id uuid not null default gen_random_uuid (),
  employee_code text null,
  first_name text not null,
  last_name text null,
  email text null,
  phone text null,
  address text null,
  position text not null,
  department text null,
  hire_date date null,
  employment_status text not null default 'active',
  salary_amount numeric (12, 2) not null default 0,
  salary_frequency text not null default 'monthly',
  salary_notes text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hr_employees_pkey primary key (id),
  constraint hr_employees_created_by_fkey foreign key (created_by) references public.admin_users (id) on delete set null,
  constraint hr_employees_status_check check (employment_status = any (array['active'::text, 'on_leave'::text, 'inactive'::text, 'terminated'::text])),
  constraint hr_employees_salary_amount_check check (salary_amount >= 0),
  constraint hr_employees_salary_frequency_check check (salary_frequency = any (array['monthly'::text, 'weekly'::text, 'daily'::text, 'hourly'::text]))
) TABLESPACE pg_default;

create unique index IF not exists hr_employees_code_uidx on public.hr_employees using btree (employee_code) TABLESPACE pg_default
where employee_code is not null;

create index IF not exists hr_employees_status_name_idx on public.hr_employees using btree (employment_status, first_name, last_name) TABLESPACE pg_default;

create table public.treasury_transactions (
  id uuid not null default gen_random_uuid (),
  transaction_type text not null,
  amount numeric (12, 2) not null,
  party_name text not null,
  procurement_order_id uuid null,
  sales_order_id uuid null,
  employee_id uuid null,
  salary_period date null,
  reference_number text null,
  notes text null,
  paid_at date not null default current_date,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint treasury_transactions_pkey primary key (id),
  constraint treasury_transactions_procurement_order_id_fkey foreign key (procurement_order_id) references public.commerce_procurement_orders (id) on delete restrict,
  constraint treasury_transactions_sales_order_id_fkey foreign key (sales_order_id) references public.commerce_sales_orders (id) on delete restrict,
  constraint treasury_transactions_employee_id_fkey foreign key (employee_id) references public.hr_employees (id) on delete restrict,
  constraint treasury_transactions_created_by_fkey foreign key (created_by) references public.admin_users (id) on delete set null,
  constraint treasury_transactions_amount_check check (amount > 0),
  constraint treasury_transactions_type_check check (transaction_type = any (array['supplier_payment'::text, 'customer_receipt'::text, 'salary_payment'::text])),
  constraint treasury_transactions_reference_check check (
    (
      transaction_type = 'supplier_payment'
      and procurement_order_id is not null
      and sales_order_id is null
      and employee_id is null
      and salary_period is null
    )
    or (
      transaction_type = 'customer_receipt'
      and procurement_order_id is null
      and sales_order_id is not null
      and employee_id is null
      and salary_period is null
    )
    or (
      transaction_type = 'salary_payment'
      and procurement_order_id is null
      and sales_order_id is null
      and employee_id is not null
      and salary_period is not null
    )
  )
) TABLESPACE pg_default;

create index IF not exists treasury_transactions_paid_at_idx on public.treasury_transactions using btree (paid_at desc, created_at desc) TABLESPACE pg_default;

create index IF not exists treasury_transactions_procurement_idx on public.treasury_transactions using btree (procurement_order_id, created_at desc) TABLESPACE pg_default
where procurement_order_id is not null;

create index IF not exists treasury_transactions_sales_idx on public.treasury_transactions using btree (sales_order_id, created_at desc) TABLESPACE pg_default
where sales_order_id is not null;

create index IF not exists treasury_transactions_employee_idx on public.treasury_transactions using btree (employee_id, salary_period desc) TABLESPACE pg_default
where employee_id is not null;

create or replace function public.treasury_get_outstanding_supplier_invoices ()
returns table (
  id uuid,
  invoice_number text,
  account_name text,
  total_amount numeric,
  paid_amount numeric,
  due_amount numeric,
  created_at timestamp with time zone
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.has_admin_permission ('treasury.view') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    procurement.id,
    procurement.invoice_number,
    supplier.name,
    procurement.total_cost,
    procurement.paid_amount,
    procurement.total_cost - procurement.paid_amount,
    procurement.created_at
  from public.commerce_procurement_orders as procurement
  join public.commerce_crm_accounts as supplier
    on supplier.id = procurement.supplier_id
  where procurement.paid_amount < procurement.total_cost
  order by procurement.created_at desc;
end;
$$;

create or replace function public.treasury_get_outstanding_customer_invoices ()
returns table (
  id uuid,
  invoice_number text,
  account_name text,
  total_amount numeric,
  paid_amount numeric,
  due_amount numeric,
  created_at timestamp with time zone
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.has_admin_permission ('treasury.view') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    sale.id,
    sale.order_number,
    customer.name,
    sale.total_amount,
    sale.paid_amount,
    sale.total_amount - sale.paid_amount,
    sale.created_at
  from public.commerce_sales_orders as sale
  join public.commerce_crm_accounts as customer
    on customer.id = sale.customer_id
  where sale.paid_amount < sale.total_amount
  order by sale.created_at desc;
end;
$$;

create or replace function public.treasury_record_supplier_payment (
  p_procurement_order_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_total numeric (12, 2);
  v_paid numeric (12, 2);
  v_amount numeric (12, 2);
  v_supplier_name text;
begin
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select procurement.total_cost, procurement.paid_amount, supplier.name
  into v_total, v_paid, v_supplier_name
  from public.commerce_procurement_orders as procurement
  join public.commerce_crm_accounts as supplier
    on supplier.id = procurement.supplier_id
  where procurement.id = p_procurement_order_id
  for update of procurement;

  if not found then
    raise exception 'Procurement invoice not found.';
  end if;

  if v_amount > (v_total - v_paid) then
    raise exception 'Payment exceeds the outstanding supplier balance.';
  end if;

  update public.commerce_procurement_orders
  set
    paid_amount = paid_amount + v_amount,
    updated_at = now()
  where id = p_procurement_order_id;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    procurement_order_id,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'supplier_payment',
    v_amount,
    v_supplier_name,
    p_procurement_order_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.treasury_record_customer_receipt (
  p_sales_order_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_total numeric (12, 2);
  v_paid numeric (12, 2);
  v_amount numeric (12, 2);
  v_customer_name text;
begin
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Receipt amount must be greater than zero.';
  end if;

  select sale.total_amount, sale.paid_amount, customer.name
  into v_total, v_paid, v_customer_name
  from public.commerce_sales_orders as sale
  join public.commerce_crm_accounts as customer
    on customer.id = sale.customer_id
  where sale.id = p_sales_order_id
  for update of sale;

  if not found then
    raise exception 'Sales invoice not found.';
  end if;

  if v_amount > (v_total - v_paid) then
    raise exception 'Receipt exceeds the outstanding customer balance.';
  end if;

  update public.commerce_sales_orders
  set
    paid_amount = paid_amount + v_amount,
    updated_at = now()
  where id = p_sales_order_id;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    sales_order_id,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'customer_receipt',
    v_amount,
    v_customer_name,
    p_sales_order_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.treasury_record_salary_payment (
  p_employee_id uuid,
  p_amount numeric,
  p_salary_period date,
  p_paid_at date,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_amount numeric (12, 2);
  v_employee_name text;
  v_salary_period date;
begin
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Salary amount must be greater than zero.';
  end if;

  if p_salary_period is null then
    raise exception 'Salary period is required.';
  end if;

  select trim(concat(first_name, ' ', coalesce(last_name, '')))
  into v_employee_name
  from public.hr_employees
  where id = p_employee_id;

  if not found then
    raise exception 'Employee not found.';
  end if;

  v_salary_period := date_trunc('month', p_salary_period)::date;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    employee_id,
    salary_period,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'salary_payment',
    v_amount,
    v_employee_name,
    p_employee_id,
    v_salary_period,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

alter table public.hr_employees enable row level security;
alter table public.treasury_transactions enable row level security;

create policy "Admins can read HR employees" on public.hr_employees for select to authenticated
using (public.has_admin_permission ('hr.view'));

create policy "Admins can add HR employees" on public.hr_employees for insert to authenticated
with check (public.has_admin_permission ('hr.edit'));

create policy "Admins can edit HR employees" on public.hr_employees for update to authenticated
using (public.has_admin_permission ('hr.edit'))
with check (public.has_admin_permission ('hr.edit'));

create policy "Admins can read Treasury transactions" on public.treasury_transactions for select to authenticated
using (public.has_admin_permission ('treasury.view'));

revoke all on function public.treasury_get_outstanding_supplier_invoices () from public;
revoke all on function public.treasury_get_outstanding_customer_invoices () from public;
revoke all on function public.treasury_record_supplier_payment (uuid, numeric, date, text, text) from public;
revoke all on function public.treasury_record_customer_receipt (uuid, numeric, date, text, text) from public;
revoke all on function public.treasury_record_salary_payment (uuid, numeric, date, date, text, text) from public;

grant execute on function public.treasury_get_outstanding_supplier_invoices () to authenticated;
grant execute on function public.treasury_get_outstanding_customer_invoices () to authenticated;
grant execute on function public.treasury_record_supplier_payment (uuid, numeric, date, text, text) to authenticated;
grant execute on function public.treasury_record_customer_receipt (uuid, numeric, date, text, text) to authenticated;
grant execute on function public.treasury_record_salary_payment (uuid, numeric, date, date, text, text) to authenticated;
