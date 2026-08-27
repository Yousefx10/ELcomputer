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
    'reviews.view', false,
    'reviews.delete', false,
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
  homepage_reviews_enabled boolean not null default true,
  homepage_reviews_view_all_enabled boolean not null default true,
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

create table public.product_reviews (
  id uuid not null default gen_random_uuid (),
  product_id uuid not null,
  user_id uuid not null,
  rating smallint not null,
  review_text text not null,
  display_full_name boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint product_reviews_pkey primary key (id),
  constraint product_reviews_product_id_fkey foreign KEY (product_id) references products (id) on delete CASCADE,
  constraint product_reviews_user_id_fkey foreign KEY (user_id) references customer_profiles (id) on delete CASCADE,
  constraint product_reviews_product_user_key unique (product_id, user_id),
  constraint product_reviews_rating_check check ((rating >= 1) and (rating <= 5)),
  constraint product_reviews_text_length_check check ((char_length(btrim(review_text)) >= 1) and (char_length(btrim(review_text)) <= 999))
) TABLESPACE pg_default;

create index IF not exists product_reviews_product_created_idx on public.product_reviews using btree (product_id, created_at desc) TABLESPACE pg_default;

create index IF not exists product_reviews_created_at_idx on public.product_reviews using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists product_reviews_user_created_idx on public.product_reviews using btree (user_id, created_at desc) TABLESPACE pg_default;

create or replace function public.sync_product_average_rating () returns trigger language plpgsql security definer
set
  search_path = public as $$
declare
  v_product_id uuid;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
  else
    v_product_id := new.product_id;
  end if;

  update public.products
  set average_rating = coalesce((
    select round(avg(reviews.rating)::numeric, 2)
    from public.product_reviews as reviews
    where reviews.product_id = v_product_id
  ), 0)
  where id = v_product_id;

  if tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      update public.products
      set average_rating = coalesce((
        select round(avg(reviews.rating)::numeric, 2)
        from public.product_reviews as reviews
        where reviews.product_id = old.product_id
      ), 0)
      where id = old.product_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger product_reviews_sync_average_rating
after insert or update of rating, product_id or delete on public.product_reviews for each row
execute function public.sync_product_average_rating ();

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

create table public.nps_responses (
  id uuid not null default gen_random_uuid (),
  response_id uuid not null,
  user_id uuid null,
  visitor_id uuid not null,
  score smallint not null,
  feedback text null,
  source text not null default 'store'::text,
  created_at timestamp with time zone not null default now(),
  constraint nps_responses_pkey primary key (id),
  constraint nps_responses_response_id_key unique (response_id),
  constraint nps_responses_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null,
  constraint nps_responses_score_check check ((score >= 0) and (score <= 10)),
  constraint nps_responses_feedback_length_check check (
    (feedback is null)
    or (
      (char_length(btrim(feedback)) >= 1)
      and (char_length(btrim(feedback)) <= 999)
    )
  ),
  constraint nps_responses_source_check check ((source ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'::text))
) TABLESPACE pg_default;

create index IF not exists nps_responses_created_at_idx on public.nps_responses using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists nps_responses_user_created_idx on public.nps_responses using btree (user_id, created_at desc) TABLESPACE pg_default
where
  (user_id is not null);

create index IF not exists nps_responses_visitor_created_idx on public.nps_responses using btree (visitor_id, created_at desc) TABLESPACE pg_default;

create or replace function public.enforce_nps_response_cooldown () returns trigger language plpgsql security definer
set
  search_path = public as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('visitor:' || new.visitor_id::text, 0)
  );

  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('user:' || new.user_id::text, 0)
    );
  end if;

  if exists (
    select 1
    from public.nps_responses as responses
    where responses.response_id <> new.response_id
      and responses.created_at >= now() - interval '90 days'
      and (
        (
          new.user_id is not null
          and (
            responses.user_id = new.user_id
            or responses.visitor_id = new.visitor_id
          )
        )
        or (
          new.user_id is null
          and responses.user_id is null
          and responses.visitor_id = new.visitor_id
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'NPS response cooldown is active.';
  end if;

  return new;
end;
$$;

create trigger nps_responses_enforce_cooldown before insert on public.nps_responses for each row
execute function public.enforce_nps_response_cooldown ();

create table public.store_analytics_sessions (
  id uuid not null,
  visitor_id uuid not null,
  user_id uuid null,
  started_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  constraint store_analytics_sessions_pkey primary key (id),
  constraint store_analytics_sessions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null,
  constraint store_analytics_sessions_time_check check ((last_seen_at >= started_at))
) TABLESPACE pg_default;

create index IF not exists store_analytics_sessions_started_idx on public.store_analytics_sessions using btree (started_at desc) TABLESPACE pg_default;

create index IF not exists store_analytics_sessions_visitor_started_idx on public.store_analytics_sessions using btree (visitor_id, started_at desc) TABLESPACE pg_default;

create index IF not exists store_analytics_sessions_user_started_idx on public.store_analytics_sessions using btree (user_id, started_at desc) TABLESPACE pg_default
where
  (user_id is not null);

create table public.store_analytics_events (
  id uuid not null default gen_random_uuid (),
  event_id uuid not null,
  session_id uuid not null,
  visitor_id uuid not null,
  user_id uuid null,
  event_name text not null,
  path text null,
  product_id uuid null,
  cart_id uuid null,
  order_id uuid null,
  quantity integer null,
  resulting_quantity integer null,
  duration_ms integer null,
  source text null,
  occurred_at timestamp with time zone not null default now(),
  constraint store_analytics_events_pkey primary key (id),
  constraint store_analytics_events_event_id_key unique (event_id),
  constraint store_analytics_events_session_id_fkey foreign KEY (session_id) references store_analytics_sessions (id) on delete CASCADE,
  constraint store_analytics_events_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null,
  constraint store_analytics_events_product_id_fkey foreign KEY (product_id) references products (id) on delete set null,
  constraint store_analytics_events_order_id_fkey foreign KEY (order_id) references customer_orders (id) on delete set null,
  constraint store_analytics_events_name_check check (
    (
      event_name = any (
        array[
          'page_view'::text,
          'product_view'::text,
          'product_dwell'::text,
          'add_to_cart'::text,
          'remove_from_cart'::text,
          'cart_quantity_changed'::text,
          'cart_cleared'::text,
          'checkout_started'::text,
          'order_created'::text
        ]
      )
    )
  ),
  constraint store_analytics_events_path_check check (
    (path is null)
    or (
      (char_length(path) >= 1)
      and (char_length(path) <= 500)
      and ("left"(path, 1) = '/'::text)
      and (position(('?'::text) in (path)) = 0)
      and (position(('#'::text) in (path)) = 0)
    )
  ),
  constraint store_analytics_events_quantity_check check (
    (quantity is null)
    or ((quantity >= 1) and (quantity <= 999))
  ),
  constraint store_analytics_events_resulting_quantity_check check (
    (resulting_quantity is null)
    or ((resulting_quantity >= 0) and (resulting_quantity <= 999))
  ),
  constraint store_analytics_events_duration_check check (
    (duration_ms is null)
    or ((duration_ms >= 0) and (duration_ms <= 1800000))
  ),
  constraint store_analytics_events_source_check check (
    (source is null)
    or (source ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'::text)
  ),
  constraint store_analytics_events_product_check check (
    (
      event_name <> all (
        array[
          'product_view'::text,
          'product_dwell'::text,
          'add_to_cart'::text,
          'remove_from_cart'::text,
          'cart_quantity_changed'::text
        ]
      )
    )
    or (product_id is not null)
  ),
  constraint store_analytics_events_cart_check check (
    (
      event_name <> all (
        array[
          'add_to_cart'::text,
          'remove_from_cart'::text,
          'cart_quantity_changed'::text,
          'cart_cleared'::text,
          'checkout_started'::text
        ]
      )
    )
    or (cart_id is not null)
  ),
  constraint store_analytics_events_order_check check (
    (event_name <> 'order_created'::text)
    or (order_id is not null)
  )
) TABLESPACE pg_default;

create index IF not exists store_analytics_events_name_occurred_idx on public.store_analytics_events using btree (event_name, occurred_at desc) TABLESPACE pg_default;

create index IF not exists store_analytics_events_session_occurred_idx on public.store_analytics_events using btree (session_id, occurred_at desc) TABLESPACE pg_default;

create index IF not exists store_analytics_events_visitor_occurred_idx on public.store_analytics_events using btree (visitor_id, occurred_at desc) TABLESPACE pg_default;

create index IF not exists store_analytics_events_user_occurred_idx on public.store_analytics_events using btree (user_id, occurred_at desc) TABLESPACE pg_default
where
  (user_id is not null);

create index IF not exists store_analytics_events_product_occurred_idx on public.store_analytics_events using btree (product_id, occurred_at desc) TABLESPACE pg_default
where
  (product_id is not null);

create index IF not exists store_analytics_events_cart_occurred_idx on public.store_analytics_events using btree (cart_id, occurred_at) TABLESPACE pg_default
where
  (cart_id is not null);

create unique index IF not exists store_analytics_events_order_created_uidx on public.store_analytics_events using btree (order_id) TABLESPACE pg_default
where
  ((event_name = 'order_created'::text) and (order_id is not null));

create or replace function public.store_analytics_get_snapshot (
  p_window_days integer default 30
) returns jsonb language plpgsql security definer stable
set
  search_path = public as $$
declare
  v_window_days integer := greatest(1, least(coalesce(p_window_days, 30), 365));
  v_window_start timestamp with time zone;
  v_nps_total bigint := 0;
  v_nps_promoters bigint := 0;
  v_nps_passives bigint := 0;
  v_nps_detractors bigint := 0;
  v_nps_score integer;
  v_total_visits bigint := 0;
  v_returning_visits bigint := 0;
  v_unique_visitors bigint := 0;
  v_mature_carts bigint := 0;
  v_abandoned_carts bigint := 0;
  v_purchasing_customers bigint := 0;
  v_repeat_customers bigint := 0;
  v_page_views bigint := 0;
  v_product_views bigint := 0;
  v_unique_product_viewers bigint := 0;
  v_avg_product_dwell_seconds numeric := 0;
  v_add_to_cart_events bigint := 0;
  v_checkout_starts bigint := 0;
  v_orders_created bigint := 0;
begin
  v_window_start := now() - make_interval(days => v_window_days);

  select
    count(*)::bigint,
    count(*) filter (where score >= 9)::bigint,
    count(*) filter (where score between 7 and 8)::bigint,
    count(*) filter (where score <= 6)::bigint
  into
    v_nps_total,
    v_nps_promoters,
    v_nps_passives,
    v_nps_detractors
  from public.nps_responses
  where created_at >= now() - interval '90 days';

  v_nps_score := case
    when v_nps_total = 0 then null
    else round(
      (
        (v_nps_promoters::numeric / v_nps_total::numeric)
        - (v_nps_detractors::numeric / v_nps_total::numeric)
      ) * 100
    )::integer
  end;

  with window_sessions as (
    select
      sessions.id,
      sessions.visitor_id,
      sessions.started_at,
      exists (
        select 1
        from public.store_analytics_sessions as previous_sessions
        where previous_sessions.visitor_id = sessions.visitor_id
          and (
            previous_sessions.started_at < sessions.started_at
            or (
              previous_sessions.started_at = sessions.started_at
              and previous_sessions.id < sessions.id
            )
          )
      ) as is_returning
    from public.store_analytics_sessions as sessions
    where sessions.started_at >= v_window_start
  )
  select
    count(*)::bigint,
    count(*) filter (where is_returning)::bigint,
    count(distinct visitor_id)::bigint
  into
    v_total_visits,
    v_returning_visits,
    v_unique_visitors
  from window_sessions;

  with cart_activity as (
    select
      events.cart_id,
      min(events.occurred_at) filter (
        where events.event_name = 'add_to_cart'
      ) as started_at,
      max(events.occurred_at) as last_activity_at,
      bool_or(events.event_name = 'order_created') as has_order
    from public.store_analytics_events as events
    where events.cart_id is not null
    group by events.cart_id
  ),
  mature_carts as (
    select cart_id, has_order
    from cart_activity
    where started_at >= v_window_start
      and (
        has_order
        or last_activity_at <= now() - interval '24 hours'
      )
  )
  select
    count(*)::bigint,
    count(*) filter (where not has_order)::bigint
  into
    v_mature_carts,
    v_abandoned_carts
  from mature_carts;

  with fulfilled_orders as (
    select orders.user_id, count(*)::bigint as fulfilled_count
    from public.customer_orders as orders
    where orders.status in ('completed', 'delivered')
    group by orders.user_id
  )
  select
    count(*)::bigint,
    count(*) filter (where fulfilled_count >= 2)::bigint
  into
    v_purchasing_customers,
    v_repeat_customers
  from fulfilled_orders;

  select
    count(*) filter (where events.event_name = 'page_view')::bigint,
    count(*) filter (where events.event_name = 'product_view')::bigint,
    count(distinct events.visitor_id) filter (
      where events.event_name = 'product_view'
    )::bigint,
    coalesce(
      round(
        (
          sum(events.duration_ms) filter (
            where events.event_name = 'product_dwell'
          )
        )::numeric
        / nullif(
          count(*) filter (
            where events.event_name = 'product_view'
          ),
          0
        )::numeric
        / 1000.0,
        2
      ),
      0
    ),
    count(*) filter (where events.event_name = 'add_to_cart')::bigint,
    count(*) filter (where events.event_name = 'checkout_started')::bigint,
    count(*) filter (where events.event_name = 'order_created')::bigint
  into
    v_page_views,
    v_product_views,
    v_unique_product_viewers,
    v_avg_product_dwell_seconds,
    v_add_to_cart_events,
    v_checkout_starts,
    v_orders_created
  from public.store_analytics_events as events
  where events.occurred_at >= v_window_start;

  return jsonb_build_object(
    'nps', jsonb_build_object(
      'score', v_nps_score,
      'total', v_nps_total,
      'promoters', v_nps_promoters,
      'passives', v_nps_passives,
      'detractors', v_nps_detractors
    ),
    'kpis', jsonb_build_object(
      'returningVisitorRate', case
        when v_total_visits = 0 then 0
        else round((v_returning_visits::numeric / v_total_visits::numeric) * 100, 2)
      end,
      'totalVisits', v_total_visits,
      'returningVisits', v_returning_visits,
      'uniqueVisitors', v_unique_visitors,
      'cartAbandonmentRate', case
        when v_mature_carts = 0 then 0
        else round((v_abandoned_carts::numeric / v_mature_carts::numeric) * 100, 2)
      end,
      'matureCarts', v_mature_carts,
      'abandonedCarts', v_abandoned_carts,
      'repeatPurchaseRate', case
        when v_purchasing_customers = 0 then 0
        else round((v_repeat_customers::numeric / v_purchasing_customers::numeric) * 100, 2)
      end,
      'purchasingCustomers', v_purchasing_customers,
      'repeatCustomers', v_repeat_customers
    ),
    'activity', jsonb_build_object(
      'pageViews', v_page_views,
      'productViews', v_product_views,
      'uniqueProductViewers', v_unique_product_viewers,
      'avgProductDwellSeconds', v_avg_product_dwell_seconds,
      'addToCartEvents', v_add_to_cart_events,
      'checkoutStarts', v_checkout_starts,
      'ordersCreated', v_orders_created
    )
  );
end;
$$;

create or replace function public.store_analytics_get_customer_behavior (
  p_user_id uuid
) returns jsonb language sql security definer stable
set
  search_path = public as $$
  with session_summary as (
    select
      count(*)::bigint as visits,
      greatest(count(*) - 1, 0)::bigint as returning_visits,
      max(last_seen_at) as last_seen_at
    from public.store_analytics_sessions
    where user_id = p_user_id
  ),
  event_summary as (
    select
      count(*) filter (where event_name = 'product_view')::bigint as product_views,
      coalesce(
        sum(duration_ms) filter (where event_name = 'product_dwell'),
        0
      )::bigint as total_product_dwell_ms,
      count(*) filter (where event_name = 'add_to_cart')::bigint as add_to_cart_events,
      count(*) filter (where event_name = 'checkout_started')::bigint as checkout_starts,
      max(occurred_at) as last_seen_at
    from public.store_analytics_events
    where user_id = p_user_id
  ),
  product_engagement as (
    select
      events.product_id,
      count(*) filter (where events.event_name = 'product_view')::bigint as view_count,
      coalesce(
        sum(events.duration_ms) filter (where events.event_name = 'product_dwell'),
        0
      )::bigint as dwell_ms,
      max(events.occurred_at) as last_viewed_at
    from public.store_analytics_events as events
    where events.user_id = p_user_id
      and events.product_id is not null
      and events.event_name in ('product_view', 'product_dwell')
    group by events.product_id
  ),
  top_products as (
    select
      products.title,
      products.slug,
      engagement.view_count,
      round((engagement.dwell_ms::numeric / 1000.0), 1) as dwell_seconds,
      engagement.last_viewed_at
    from product_engagement as engagement
    join public.products as products
      on products.id = engagement.product_id
    order by
      engagement.view_count desc,
      engagement.dwell_ms desc,
      engagement.last_viewed_at desc
    limit 5
  )
  select jsonb_build_object(
    'available', true,
    'visits', sessions.visits,
    'returningVisits', sessions.returning_visits,
    'productViews', events.product_views,
    'totalProductDwellSeconds',
      round((events.total_product_dwell_ms::numeric / 1000.0), 1),
    'averageProductDwellSeconds',
      case
        when events.product_views = 0 then 0
        else round(
          (
            events.total_product_dwell_ms::numeric
            / events.product_views::numeric
            / 1000.0
          ),
          1
        )
      end,
    'addToCartEvents', events.add_to_cart_events,
    'checkoutStarts', events.checkout_starts,
    'lastSeenAt', case
      when sessions.last_seen_at is null then events.last_seen_at
      when events.last_seen_at is null then sessions.last_seen_at
      else greatest(sessions.last_seen_at, events.last_seen_at)
    end,
    'products', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'title', top_products.title,
            'slug', top_products.slug,
            'viewCount', top_products.view_count,
            'dwellSeconds', top_products.dwell_seconds,
            'lastViewedAt', top_products.last_viewed_at
          )
          order by
            top_products.view_count desc,
            top_products.dwell_seconds desc,
            top_products.last_viewed_at desc
        )
        from top_products
      ),
      '[]'::jsonb
    )
  )
  from session_summary as sessions
  cross join event_summary as events;
$$;

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
alter table public.product_reviews enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.nps_responses enable row level security;
alter table public.store_analytics_sessions enable row level security;
alter table public.store_analytics_events enable row level security;

revoke all on table public.product_reviews from anon, authenticated;
revoke all on table public.nps_responses from anon, authenticated;
revoke all on table public.store_analytics_sessions from anon, authenticated;
revoke all on table public.store_analytics_events from anon, authenticated;

grant select, insert, update, delete on table public.nps_responses to service_role;
grant select, insert, update, delete on table public.store_analytics_sessions to service_role;
grant select, insert, update, delete on table public.store_analytics_events to service_role;

revoke all on function public.store_analytics_get_snapshot (integer) from public;
revoke all on function public.store_analytics_get_snapshot (integer) from anon;
revoke all on function public.store_analytics_get_snapshot (integer) from authenticated;
grant execute on function public.store_analytics_get_snapshot (integer) to service_role;

revoke all on function public.store_analytics_get_customer_behavior (uuid) from public;
revoke all on function public.store_analytics_get_customer_behavior (uuid) from anon;
revoke all on function public.store_analytics_get_customer_behavior (uuid) from authenticated;
grant execute on function public.store_analytics_get_customer_behavior (uuid) to service_role;

revoke all on function public.enforce_nps_response_cooldown () from public;
revoke all on function public.enforce_nps_response_cooldown () from anon;
revoke all on function public.enforce_nps_response_cooldown () from authenticated;
grant execute on function public.enforce_nps_response_cooldown () to service_role;

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

create index IF not exists customer_orders_created_at_idx on public.customer_orders using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists commerce_sales_orders_created_at_idx on public.commerce_sales_orders using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists commerce_order_returns_created_at_idx on public.commerce_order_returns using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists commerce_inventory_movements_created_at_idx on public.commerce_inventory_movements using btree (created_at desc) TABLESPACE pg_default;

create or replace function public.dashboard_get_analysis_overview ()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_week_start date;
  v_month_start date;
  v_result jsonb;
begin
  if not public.has_admin_permission ('dashboard.analysis') then
    raise exception 'Not authorized';
  end if;

  v_week_start := date_trunc('week', v_today::timestamp)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;

  with periods as (
    select
      'today'::text as period_key,
      v_today as current_start,
      v_today + 1 as current_end,
      v_today - 1 as previous_start,
      v_today as previous_end
    union all
    select
      'weekly',
      v_week_start,
      v_week_start + 7,
      v_week_start - 7,
      v_week_start
    union all
    select
      'monthly',
      v_month_start,
      (v_month_start + interval '1 month')::date,
      (v_month_start - interval '1 month')::date,
      v_month_start
  ),
  order_events as (
    select
      (orders.created_at at time zone 'Africa/Cairo')::date as event_date,
      orders.total_amount::numeric as amount,
      orders.status not in ('cancelled', 'refunded') as revenue_eligible
    from public.customer_orders as orders

    union all

    select
      (sales.created_at at time zone 'Africa/Cairo')::date,
      sales.total_amount::numeric,
      true
    from public.commerce_sales_orders as sales
  ),
  sales_events as (
    select
      (orders.created_at at time zone 'Africa/Cairo')::date as event_date,
      items.quantity::numeric as units
    from public.customer_order_items as items
    join public.customer_orders as orders
      on orders.id = items.order_id
    where orders.status not in ('cancelled', 'refunded')

    union all

    select
      (sales.created_at at time zone 'Africa/Cairo')::date,
      items.quantity::numeric
    from public.commerce_sales_items as items
    join public.commerce_sales_orders as sales
      on sales.id = items.sales_order_id
  )
  select jsonb_object_agg(
    periods.period_key,
    jsonb_build_object(
      'current', jsonb_build_object(
        'orders', (
          select count(*)
          from order_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
        ),
        'sales', (
          select coalesce(sum(units), 0)
          from sales_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
        ),
        'revenue', (
          select coalesce(sum(amount), 0)
          from order_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
            and revenue_eligible
        )
      ),
      'previous', jsonb_build_object(
        'orders', (
          select count(*)
          from order_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
        ),
        'sales', (
          select coalesce(sum(units), 0)
          from sales_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
        ),
        'revenue', (
          select coalesce(sum(amount), 0)
          from order_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
            and revenue_eligible
        )
      )
    )
  )
  into v_result
  from periods;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.dashboard_get_analysis_chart (
  p_start_date date,
  p_end_date date,
  p_bucket text default 'day'
)
returns table (
  period_start date,
  orders bigint,
  sales numeric,
  return_units numeric,
  coupons bigint,
  stock numeric,
  revenue numeric,
  expenses numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_bucket text := case when lower(coalesce(p_bucket, 'day')) = 'month' then 'month' else 'day' end;
  v_start_timestamp timestamp with time zone;
  v_end_timestamp timestamp with time zone;
begin
  if not public.has_admin_permission ('dashboard.analysis') then
    raise exception 'Not authorized';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be on or after the start date.';
  end if;

  if (p_end_date - p_start_date) > 1095 then
    raise exception 'Analysis date ranges cannot exceed three years.';
  end if;

  v_start_timestamp := p_start_date::timestamp at time zone 'Africa/Cairo';
  v_end_timestamp := (p_end_date + 1)::timestamp at time zone 'Africa/Cairo';

  return query
  with buckets as (
    select generated_bucket::date as bucket_date
    from generate_series(
      case
        when v_bucket = 'month' then date_trunc('month', p_start_date::timestamp)
        else p_start_date::timestamp
      end,
      case
        when v_bucket = 'month' then date_trunc('month', p_end_date::timestamp)
        else p_end_date::timestamp
      end,
      case
        when v_bucket = 'month' then interval '1 month'
        else interval '1 day'
      end
    ) as series(generated_bucket)
  ),
  online_orders as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as order_count,
      coalesce(sum(orders.total_amount) filter (where orders.status not in ('cancelled', 'refunded')), 0)::numeric as revenue_amount
    from public.customer_orders as orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
    group by 1
  ),
  manual_orders as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', sales.created_at at time zone 'Africa/Cairo')::date
        else (sales.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as order_count,
      coalesce(sum(sales.total_amount), 0)::numeric as revenue_amount
    from public.commerce_sales_orders as sales
    where sales.created_at >= v_start_timestamp
      and sales.created_at < v_end_timestamp
    group by 1
  ),
  order_metrics as (
    select
      combined.bucket_date,
      sum(combined.order_count)::bigint as order_count,
      sum(combined.revenue_amount)::numeric as revenue_amount
    from (
      select * from online_orders
      union all
      select * from manual_orders
    ) as combined
    group by combined.bucket_date
  ),
  online_sales as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(items.quantity), 0)::numeric as units
    from public.customer_order_items as items
    join public.customer_orders as orders
      on orders.id = items.order_id
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
      and orders.status not in ('cancelled', 'refunded')
    group by 1
  ),
  manual_sales as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', sales.created_at at time zone 'Africa/Cairo')::date
        else (sales.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(items.quantity), 0)::numeric as units
    from public.commerce_sales_items as items
    join public.commerce_sales_orders as sales
      on sales.id = items.sales_order_id
    where sales.created_at >= v_start_timestamp
      and sales.created_at < v_end_timestamp
    group by 1
  ),
  sales_metrics as (
    select combined.bucket_date, sum(combined.units)::numeric as units
    from (
      select * from online_sales
      union all
      select * from manual_sales
    ) as combined
    group by combined.bucket_date
  ),
  return_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', return_orders.created_at at time zone 'Africa/Cairo')::date
        else (return_orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(return_orders.total_items), 0)::numeric as units
    from public.commerce_order_returns as return_orders
    where return_orders.created_at >= v_start_timestamp
      and return_orders.created_at < v_end_timestamp
    group by 1
  ),
  coupon_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as uses
    from public.customer_orders as orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
      and nullif(trim(orders.coupon_code), '') is not null
    group by 1
  ),
  stock_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', movements.created_at at time zone 'Africa/Cairo')::date
        else (movements.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(movements.quantity_change), 0)::numeric as quantity_change
    from public.commerce_inventory_movements as movements
    where movements.created_at >= v_start_timestamp
      and movements.created_at < v_end_timestamp
    group by 1
  ),
  expense_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', transactions.paid_at::timestamp)::date
        else transactions.paid_at
      end as bucket_date,
      coalesce(sum(transactions.amount), 0)::numeric as amount
    from public.treasury_transactions as transactions
    where transactions.paid_at >= p_start_date
      and transactions.paid_at <= p_end_date
      and transactions.transaction_type in ('supplier_payment', 'salary_payment')
    group by 1
  )
  select
    buckets.bucket_date,
    coalesce(order_metrics.order_count, 0)::bigint,
    coalesce(sales_metrics.units, 0)::numeric,
    coalesce(return_metrics.units, 0)::numeric,
    coalesce(coupon_metrics.uses, 0)::bigint,
    coalesce(stock_metrics.quantity_change, 0)::numeric,
    coalesce(order_metrics.revenue_amount, 0)::numeric,
    coalesce(expense_metrics.amount, 0)::numeric
  from buckets
  left join order_metrics on order_metrics.bucket_date = buckets.bucket_date
  left join sales_metrics on sales_metrics.bucket_date = buckets.bucket_date
  left join return_metrics on return_metrics.bucket_date = buckets.bucket_date
  left join coupon_metrics on coupon_metrics.bucket_date = buckets.bucket_date
  left join stock_metrics on stock_metrics.bucket_date = buckets.bucket_date
  left join expense_metrics on expense_metrics.bucket_date = buckets.bucket_date
  order by buckets.bucket_date;
end;
$$;

revoke all on function public.dashboard_get_analysis_overview () from public;
revoke all on function public.dashboard_get_analysis_chart (date, date, text) from public;

grant execute on function public.dashboard_get_analysis_overview () to authenticated;
grant execute on function public.dashboard_get_analysis_chart (date, date, text) to authenticated;

-- Internal-user analytics exclusion final-state delta.
-- Kept in the schema backup so deleted staff identities remain excluded.
begin;

-- Internal identities are kept in a ledger without an auth.users foreign key.
-- This preserves the exclusion even if an administrator account is deleted.
create table if not exists public.store_analytics_internal_users (
  user_id uuid not null,
  marked_at timestamp with time zone not null default now(),
  constraint store_analytics_internal_users_pkey primary key (user_id)
);

create table if not exists public.store_analytics_internal_carts (
  cart_id uuid not null,
  marked_at timestamp with time zone not null default now(),
  constraint store_analytics_internal_carts_pkey primary key (cart_id)
);

create or replace function public.serialize_store_analytics_internal_user_insert ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('store-analytics-internal-user:' || new.user_id::text, 0)
  );

  return new;
end;
$$;

drop trigger if exists store_analytics_internal_users_serialize_insert
on public.store_analytics_internal_users;

create trigger store_analytics_internal_users_serialize_insert
before insert on public.store_analytics_internal_users
for each row
execute function public.serialize_store_analytics_internal_user_insert();

create or replace function public.prevent_store_analytics_ledger_mutation ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Store analytics exclusion ledgers are append-only.';
end;
$$;

drop trigger if exists store_analytics_internal_users_immutable
on public.store_analytics_internal_users;

create trigger store_analytics_internal_users_immutable
before update or delete on public.store_analytics_internal_users
for each row
execute function public.prevent_store_analytics_ledger_mutation();

drop trigger if exists store_analytics_internal_carts_immutable
on public.store_analytics_internal_carts;

create trigger store_analytics_internal_carts_immutable
before update or delete on public.store_analytics_internal_carts
for each row
execute function public.prevent_store_analytics_ledger_mutation();

alter table public.nps_responses
add column if not exists is_internal boolean not null default false;

alter table public.store_analytics_sessions
add column if not exists is_internal boolean not null default false;

alter table public.customer_profiles
add column if not exists is_internal boolean not null default false;

update public.nps_responses
set is_internal = false
where is_internal is null;

update public.store_analytics_sessions
set is_internal = false
where is_internal is null;

update public.customer_profiles
set is_internal = false
where is_internal is null;

alter table public.nps_responses
alter column is_internal set default false,
alter column is_internal set not null;

alter table public.store_analytics_sessions
alter column is_internal set default false,
alter column is_internal set not null;

alter table public.customer_profiles
alter column is_internal set default false,
alter column is_internal set not null;

create or replace function public.enforce_nps_response_internal_identity ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  if tg_op = 'UPDATE' and old.is_internal then
    new.is_internal := true;
    return new;
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  return new;
end;
$$;

drop trigger if exists a_nps_responses_enforce_internal_identity
on public.nps_responses;

create trigger a_nps_responses_enforce_internal_identity
before insert or update on public.nps_responses
for each row
execute function public.enforce_nps_response_internal_identity();

create or replace function public.enforce_store_analytics_session_internal_identity ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  if tg_op = 'UPDATE' and old.is_internal then
    new.is_internal := true;
    return new;
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  return new;
end;
$$;

drop trigger if exists store_analytics_sessions_enforce_internal_identity
on public.store_analytics_sessions;

create trigger store_analytics_sessions_enforce_internal_identity
before insert or update of user_id, is_internal on public.store_analytics_sessions
for each row
execute function public.enforce_store_analytics_session_internal_identity();

create or replace function public.enforce_nps_response_cooldown ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  -- Derive this again here so correctness does not depend on the ordering of
  -- multiple BEFORE INSERT triggers.
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  if new.is_internal then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('visitor:' || new.visitor_id::text, 0)
  );

  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('user:' || new.user_id::text, 0)
    );
  end if;

  if exists (
    select 1
    from public.nps_responses as responses
    where responses.response_id <> new.response_id
      and responses.is_internal = false
      and responses.created_at >= now() - interval '90 days'
      and (
        (
          new.user_id is not null
          and (
            responses.user_id = new.user_id
            or responses.visitor_id = new.visitor_id
          )
        )
        or (
          new.user_id is null
          and responses.user_id is null
          and responses.visitor_id = new.visitor_id
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'NPS response cooldown is active.';
  end if;

  return new;
end;
$$;

create or replace function public.apply_store_analytics_internal_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nps_responses
  set is_internal = true
  where user_id = new.user_id
    and is_internal = false;

  update public.store_analytics_sessions
  set is_internal = true
  where user_id = new.user_id
    and is_internal = false;

  update public.customer_profiles
  set is_internal = true
  where id = new.user_id
    and is_internal = false;

  insert into public.store_analytics_internal_carts (cart_id)
  select distinct events.cart_id
  from public.store_analytics_events as events
  join public.store_analytics_sessions as sessions
    on sessions.id = events.session_id
  where events.cart_id is not null
    and (
      events.user_id = new.user_id
      or sessions.user_id = new.user_id
    )
  on conflict (cart_id) do nothing;

  return new;
end;
$$;

drop trigger if exists store_analytics_internal_user_apply
on public.store_analytics_internal_users;

create trigger store_analytics_internal_user_apply
after insert on public.store_analytics_internal_users
for each row
execute function public.apply_store_analytics_internal_user();

create or replace function public.mark_admin_as_store_analytics_internal ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_analytics_internal_users (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists admin_users_mark_store_analytics_internal
on public.admin_users;

create trigger admin_users_mark_store_analytics_internal
after insert on public.admin_users
for each row
execute function public.mark_admin_as_store_analytics_internal();

create or replace function public.enforce_customer_profile_internal_identity ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'store-analytics-internal-user:' || new.id::text,
      0
    )
  );

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.id
  );

  return new;
end;
$$;

drop trigger if exists customer_profiles_enforce_internal_identity
on public.customer_profiles;

create trigger customer_profiles_enforce_internal_identity
before insert or update on public.customer_profiles
for each row
execute function public.enforce_customer_profile_internal_identity();

insert into public.store_analytics_internal_users (user_id)
select admins.id
from public.admin_users as admins
on conflict (user_id) do nothing;

-- Make the migration idempotent even when a ledger row already existed.
update public.nps_responses as responses
set is_internal = true
where responses.is_internal = false
  and exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = responses.user_id
  );

update public.store_analytics_sessions as sessions
set is_internal = true
where sessions.is_internal = false
  and exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = sessions.user_id
  );

update public.customer_profiles as profiles
set is_internal = true
where profiles.is_internal = false
  and exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = profiles.id
  );

insert into public.store_analytics_internal_carts (cart_id)
select distinct events.cart_id
from public.store_analytics_events as events
join public.store_analytics_sessions as sessions
  on sessions.id = events.session_id
where events.cart_id is not null
  and sessions.is_internal = true
on conflict (cart_id) do nothing;

create index if not exists nps_responses_external_created_idx
on public.nps_responses (created_at desc)
where is_internal = false;

create index if not exists store_analytics_sessions_external_started_idx
on public.store_analytics_sessions (started_at desc)
where is_internal = false;

create index if not exists store_analytics_sessions_external_visitor_started_idx
on public.store_analytics_sessions (visitor_id, started_at, id)
where is_internal = false;

create index if not exists store_analytics_events_occurred_session_idx
on public.store_analytics_events (occurred_at desc, session_id);

create index if not exists customer_profiles_external_created_idx
on public.customer_profiles (created_at desc)
where is_internal = false;

create index if not exists customer_profiles_external_active_idx
on public.customer_profiles (is_active)
where is_internal = false;

create or replace function public.store_analytics_is_internal_user (
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.store_analytics_internal_users as internal_users
      where internal_users.user_id = p_user_id
    );
$$;

create or replace function public.store_analytics_mark_internal_cart (
  p_cart_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cart_id is null then
    return false;
  end if;

  insert into public.store_analytics_internal_carts (cart_id)
  values (p_cart_id)
  on conflict (cart_id) do nothing;

  return true;
end;
$$;

create or replace function public.store_analytics_mark_internal_session_carts (
  p_session_id uuid,
  p_visitor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if p_session_id is null or p_visitor_id is null then
    return 0;
  end if;

  if not exists (
    select 1
    from public.store_analytics_sessions as sessions
    where sessions.id = p_session_id
      and sessions.visitor_id = p_visitor_id
      and sessions.is_internal = true
  ) then
    return 0;
  end if;

  insert into public.store_analytics_internal_carts (cart_id)
  select distinct events.cart_id
  from public.store_analytics_events as events
  where events.session_id = p_session_id
    and events.visitor_id = p_visitor_id
    and events.cart_id is not null
  on conflict (cart_id) do nothing;

  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;

create or replace function public.store_analytics_get_snapshot (
  p_window_days integer default 30
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_window_days integer := greatest(1, least(coalesce(p_window_days, 30), 365));
  v_window_start timestamp with time zone;
  v_nps_total bigint := 0;
  v_nps_promoters bigint := 0;
  v_nps_passives bigint := 0;
  v_nps_detractors bigint := 0;
  v_nps_score integer;
  v_total_visits bigint := 0;
  v_returning_visits bigint := 0;
  v_unique_visitors bigint := 0;
  v_mature_carts bigint := 0;
  v_abandoned_carts bigint := 0;
  v_purchasing_customers bigint := 0;
  v_repeat_customers bigint := 0;
  v_page_views bigint := 0;
  v_product_views bigint := 0;
  v_unique_product_viewers bigint := 0;
  v_avg_product_dwell_seconds numeric := 0;
  v_add_to_cart_events bigint := 0;
  v_checkout_starts bigint := 0;
  v_orders_created bigint := 0;
begin
  v_window_start := now() - make_interval(days => v_window_days);

  select
    count(*)::bigint,
    count(*) filter (where score >= 9)::bigint,
    count(*) filter (where score between 7 and 8)::bigint,
    count(*) filter (where score <= 6)::bigint
  into
    v_nps_total,
    v_nps_promoters,
    v_nps_passives,
    v_nps_detractors
  from public.nps_responses
  where created_at >= now() - interval '90 days'
    and is_internal = false;

  v_nps_score := case
    when v_nps_total = 0 then null
    else round(
      (
        (v_nps_promoters::numeric / v_nps_total::numeric)
        - (v_nps_detractors::numeric / v_nps_total::numeric)
      ) * 100
    )::integer
  end;

  with window_sessions as (
    select
      sessions.id,
      sessions.visitor_id,
      sessions.started_at,
      exists (
        select 1
        from public.store_analytics_sessions as previous_sessions
        where previous_sessions.visitor_id = sessions.visitor_id
          and previous_sessions.is_internal = false
          and (
            previous_sessions.started_at < sessions.started_at
            or (
              previous_sessions.started_at = sessions.started_at
              and previous_sessions.id < sessions.id
            )
          )
      ) as is_returning
    from public.store_analytics_sessions as sessions
    where sessions.started_at >= v_window_start
      and sessions.is_internal = false
  )
  select
    count(*)::bigint,
    count(*) filter (where is_returning)::bigint,
    count(distinct visitor_id)::bigint
  into
    v_total_visits,
    v_returning_visits,
    v_unique_visitors
  from window_sessions;

  with candidate_carts as (
    select distinct events.cart_id
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.event_name = 'add_to_cart'
      and events.occurred_at >= v_window_start
      and events.cart_id is not null
      and sessions.is_internal = false
      and not exists (
        select 1
        from public.store_analytics_internal_carts as internal_carts
        where internal_carts.cart_id = events.cart_id
      )
      and not exists (
        select 1
        from public.store_analytics_events as earlier_events
        join public.store_analytics_sessions as earlier_sessions
          on earlier_sessions.id = earlier_events.session_id
        where earlier_events.cart_id = events.cart_id
          and earlier_events.event_name = 'add_to_cart'
          and earlier_events.occurred_at < v_window_start
          and earlier_sessions.is_internal = false
      )
  ),
  cart_activity as (
    select
      events.cart_id,
      min(events.occurred_at) filter (
        where events.event_name = 'add_to_cart'
      ) as started_at,
      max(events.occurred_at) as last_activity_at,
      bool_or(events.event_name = 'order_created') as has_order
    from public.store_analytics_events as events
    join candidate_carts
      on candidate_carts.cart_id = events.cart_id
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where sessions.is_internal = false
    group by events.cart_id
  ),
  mature_carts as (
    select cart_id, has_order
    from cart_activity
    where started_at >= v_window_start
      and (
        has_order
        or last_activity_at <= now() - interval '24 hours'
      )
  )
  select
    count(*)::bigint,
    count(*) filter (where not has_order)::bigint
  into
    v_mature_carts,
    v_abandoned_carts
  from mature_carts;

  with fulfilled_orders as (
    select orders.user_id, count(*)::bigint as fulfilled_count
    from public.customer_orders as orders
    where orders.status in ('completed', 'delivered')
      and not exists (
        select 1
        from public.store_analytics_internal_users as internal_users
        where internal_users.user_id = orders.user_id
      )
    group by orders.user_id
  )
  select
    count(*)::bigint,
    count(*) filter (where fulfilled_count >= 2)::bigint
  into
    v_purchasing_customers,
    v_repeat_customers
  from fulfilled_orders;

  select
    count(*) filter (where events.event_name = 'page_view')::bigint,
    count(*) filter (where events.event_name = 'product_view')::bigint,
    count(distinct events.visitor_id) filter (
      where events.event_name = 'product_view'
    )::bigint,
    coalesce(
      round(
        (
          sum(events.duration_ms) filter (
            where events.event_name = 'product_dwell'
          )
        )::numeric
        / nullif(
          count(*) filter (
            where events.event_name = 'product_view'
          ),
          0
        )::numeric
        / 1000.0,
        2
      ),
      0
    ),
    count(*) filter (where events.event_name = 'add_to_cart')::bigint,
    count(*) filter (where events.event_name = 'checkout_started')::bigint,
    count(*) filter (where events.event_name = 'order_created')::bigint
  into
    v_page_views,
    v_product_views,
    v_unique_product_viewers,
    v_avg_product_dwell_seconds,
    v_add_to_cart_events,
    v_checkout_starts,
    v_orders_created
  from public.store_analytics_events as events
  join public.store_analytics_sessions as sessions
    on sessions.id = events.session_id
  where events.occurred_at >= v_window_start
    and sessions.is_internal = false;

  return jsonb_build_object(
    'nps', jsonb_build_object(
      'score', v_nps_score,
      'total', v_nps_total,
      'promoters', v_nps_promoters,
      'passives', v_nps_passives,
      'detractors', v_nps_detractors
    ),
    'kpis', jsonb_build_object(
      'returningVisitorRate', case
        when v_total_visits = 0 then 0
        else round((v_returning_visits::numeric / v_total_visits::numeric) * 100, 2)
      end,
      'totalVisits', v_total_visits,
      'returningVisits', v_returning_visits,
      'uniqueVisitors', v_unique_visitors,
      'cartAbandonmentRate', case
        when v_mature_carts = 0 then 0
        else round((v_abandoned_carts::numeric / v_mature_carts::numeric) * 100, 2)
      end,
      'matureCarts', v_mature_carts,
      'abandonedCarts', v_abandoned_carts,
      'repeatPurchaseRate', case
        when v_purchasing_customers = 0 then 0
        else round((v_repeat_customers::numeric / v_purchasing_customers::numeric) * 100, 2)
      end,
      'purchasingCustomers', v_purchasing_customers,
      'repeatCustomers', v_repeat_customers
    ),
    'activity', jsonb_build_object(
      'pageViews', v_page_views,
      'productViews', v_product_views,
      'uniqueProductViewers', v_unique_product_viewers,
      'avgProductDwellSeconds', v_avg_product_dwell_seconds,
      'addToCartEvents', v_add_to_cart_events,
      'checkoutStarts', v_checkout_starts,
      'ordersCreated', v_orders_created
    )
  );
end;
$$;

create or replace function public.store_analytics_get_customer_behavior (
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null or exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = p_user_id
  ) then
    return jsonb_build_object(
      'available', false,
      'visits', 0,
      'returningVisits', 0,
      'productViews', 0,
      'totalProductDwellSeconds', 0,
      'averageProductDwellSeconds', 0,
      'addToCartEvents', 0,
      'checkoutStarts', 0,
      'lastSeenAt', null,
      'products', '[]'::jsonb
    );
  end if;

  with session_summary as (
    select
      count(*)::bigint as visits,
      greatest(count(*) - 1, 0)::bigint as returning_visits,
      max(last_seen_at) as last_seen_at
    from public.store_analytics_sessions
    where user_id = p_user_id
      and is_internal = false
  ),
  event_summary as (
    select
      count(*) filter (where events.event_name = 'product_view')::bigint as product_views,
      coalesce(
        sum(events.duration_ms) filter (
          where events.event_name = 'product_dwell'
        ),
        0
      )::bigint as total_product_dwell_ms,
      count(*) filter (
        where events.event_name = 'add_to_cart'
      )::bigint as add_to_cart_events,
      count(*) filter (
        where events.event_name = 'checkout_started'
      )::bigint as checkout_starts,
      max(events.occurred_at) as last_seen_at
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.user_id = p_user_id
      and sessions.is_internal = false
  ),
  product_engagement as (
    select
      events.product_id,
      count(*) filter (
        where events.event_name = 'product_view'
      )::bigint as view_count,
      coalesce(
        sum(events.duration_ms) filter (
          where events.event_name = 'product_dwell'
        ),
        0
      )::bigint as dwell_ms,
      max(events.occurred_at) as last_viewed_at
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.user_id = p_user_id
      and sessions.is_internal = false
      and events.product_id is not null
      and events.event_name in ('product_view', 'product_dwell')
    group by events.product_id
  ),
  top_products as (
    select
      products.title,
      products.slug,
      engagement.view_count,
      round((engagement.dwell_ms::numeric / 1000.0), 1) as dwell_seconds,
      engagement.last_viewed_at
    from product_engagement as engagement
    join public.products as products
      on products.id = engagement.product_id
    order by
      engagement.view_count desc,
      engagement.dwell_ms desc,
      engagement.last_viewed_at desc
    limit 5
  )
  select jsonb_build_object(
    'available', true,
    'visits', sessions.visits,
    'returningVisits', sessions.returning_visits,
    'productViews', events.product_views,
    'totalProductDwellSeconds',
      round((events.total_product_dwell_ms::numeric / 1000.0), 1),
    'averageProductDwellSeconds',
      case
        when events.product_views = 0 then 0
        else round(
          (
            events.total_product_dwell_ms::numeric
            / events.product_views::numeric
            / 1000.0
          ),
          1
        )
      end,
    'addToCartEvents', events.add_to_cart_events,
    'checkoutStarts', events.checkout_starts,
    'lastSeenAt', case
      when sessions.last_seen_at is null then events.last_seen_at
      when events.last_seen_at is null then sessions.last_seen_at
      else greatest(sessions.last_seen_at, events.last_seen_at)
    end,
    'products', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'title', top_products.title,
            'slug', top_products.slug,
            'viewCount', top_products.view_count,
            'dwellSeconds', top_products.dwell_seconds,
            'lastViewedAt', top_products.last_viewed_at
          )
          order by
            top_products.view_count desc,
            top_products.dwell_seconds desc,
            top_products.last_viewed_at desc
        )
        from top_products
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from session_summary as sessions
  cross join event_summary as events;

  return v_result;
end;
$$;

alter table public.store_analytics_internal_users enable row level security;
alter table public.store_analytics_internal_carts enable row level security;

revoke all on table public.store_analytics_internal_users
from public, anon, authenticated;
revoke all on table public.store_analytics_internal_carts
from public, anon, authenticated;

grant select, insert
on table public.store_analytics_internal_users
to service_role;
grant select, insert
on table public.store_analytics_internal_carts
to service_role;

revoke update, delete, truncate
on table public.store_analytics_internal_users
from service_role;
revoke update, delete, truncate
on table public.store_analytics_internal_carts
from service_role;

revoke all on function public.prevent_store_analytics_ledger_mutation ()
from public, anon, authenticated;
grant execute on function public.prevent_store_analytics_ledger_mutation ()
to service_role;

revoke all on function public.serialize_store_analytics_internal_user_insert ()
from public, anon, authenticated;
grant execute on function public.serialize_store_analytics_internal_user_insert ()
to service_role;

revoke all on function public.enforce_nps_response_internal_identity ()
from public, anon, authenticated;
grant execute on function public.enforce_nps_response_internal_identity ()
to service_role;

revoke all on function public.enforce_store_analytics_session_internal_identity ()
from public, anon, authenticated;
grant execute on function public.enforce_store_analytics_session_internal_identity ()
to service_role;

revoke all on function public.store_analytics_is_internal_user (uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_is_internal_user (uuid)
to service_role;

revoke all on function public.store_analytics_mark_internal_cart (uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_mark_internal_cart (uuid)
to service_role;

revoke all on function public.store_analytics_mark_internal_session_carts (uuid, uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_mark_internal_session_carts (uuid, uuid)
to service_role;

revoke all on function public.apply_store_analytics_internal_user ()
from public, anon, authenticated;
grant execute on function public.apply_store_analytics_internal_user ()
to service_role;

revoke all on function public.mark_admin_as_store_analytics_internal ()
from public, anon, authenticated;
grant execute on function public.mark_admin_as_store_analytics_internal ()
to service_role;

revoke all on function public.enforce_customer_profile_internal_identity ()
from public, anon, authenticated;
grant execute on function public.enforce_customer_profile_internal_identity ()
to service_role;

revoke all on function public.store_analytics_get_snapshot (integer)
from public, anon, authenticated;
grant execute on function public.store_analytics_get_snapshot (integer)
to service_role;

revoke all on function public.store_analytics_get_customer_behavior (uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_get_customer_behavior (uuid)
to service_role;

-- CRM calls and case lifecycle final-state delta.
create index if not exists commerce_crm_accounts_entity_name_idx
on public.commerce_crm_accounts (entity_type, name, id);

create table if not exists public.commerce_crm_activities (
  id uuid not null default gen_random_uuid(),
  crm_account_id uuid not null,
  activity_type text not null,
  status text not null,
  subject text not null,
  notes text null,
  priority text null,
  occurred_at timestamp with time zone not null,
  closed_at timestamp with time zone null,
  effective_at timestamp with time zone
    generated always as (coalesce(closed_at, occurred_at)) stored,
  resolution text null,
  created_by uuid null,
  closed_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint commerce_crm_activities_pkey primary key (id),
  constraint commerce_crm_activities_crm_account_id_fkey
    foreign key (crm_account_id)
    references public.commerce_crm_accounts (id)
    on delete restrict,
  constraint commerce_crm_activities_created_by_fkey
    foreign key (created_by)
    references public.admin_users (id)
    on delete set null,
  constraint commerce_crm_activities_closed_by_fkey
    foreign key (closed_by)
    references public.admin_users (id)
    on delete set null,
  constraint commerce_crm_activities_type_check
    check (activity_type in ('call', 'case')),
  constraint commerce_crm_activities_status_check
    check (status in ('completed', 'raised', 'closed')),
  constraint commerce_crm_activities_priority_check
    check (
      priority is null
      or priority in ('low', 'normal', 'high', 'urgent')
    ),
  constraint commerce_crm_activities_subject_check
    check (
      char_length(btrim(subject)) between 1 and 200
    ),
  constraint commerce_crm_activities_notes_check
    check (
      notes is null
      or char_length(btrim(notes)) between 1 and 5000
    ),
  constraint commerce_crm_activities_resolution_check
    check (
      resolution is null
      or char_length(btrim(resolution)) between 1 and 5000
    ),
  constraint commerce_crm_activities_lifecycle_check
    check (
      (
        activity_type = 'call'
        and status = 'completed'
        and priority is null
        and closed_at is null
        and closed_by is null
        and resolution is null
      )
      or (
        activity_type = 'case'
        and priority is not null
        and (
          (
            status = 'raised'
            and closed_at is null
            and closed_by is null
            and resolution is null
          )
          or (
            status = 'closed'
            and closed_at is not null
            and closed_at >= occurred_at
          )
        )
      )
    )
);

create index if not exists commerce_crm_activities_occurred_idx
on public.commerce_crm_activities (occurred_at desc, id desc);

create index if not exists commerce_crm_activities_effective_idx
on public.commerce_crm_activities (effective_at desc, id desc);

create index if not exists commerce_crm_activities_account_effective_idx
on public.commerce_crm_activities (
  crm_account_id,
  effective_at desc,
  id desc
);

create index if not exists commerce_crm_activities_type_status_effective_idx
on public.commerce_crm_activities (
  activity_type,
  status,
  effective_at desc,
  id desc
);

create index if not exists commerce_crm_activities_open_cases_idx
on public.commerce_crm_activities (
  crm_account_id,
  occurred_at desc,
  id desc
)
where activity_type = 'case'
  and status = 'raised';

create or replace function public.enforce_commerce_crm_activity_transition ()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Preserve activity history when an admin account is removed. The foreign
  -- keys may only clear their attribution columns; no activity data can change.
  if new.id is not distinct from old.id
    and new.crm_account_id is not distinct from old.crm_account_id
    and new.activity_type is not distinct from old.activity_type
    and new.status is not distinct from old.status
    and new.subject is not distinct from old.subject
    and new.notes is not distinct from old.notes
    and new.priority is not distinct from old.priority
    and new.occurred_at is not distinct from old.occurred_at
    and new.closed_at is not distinct from old.closed_at
    and new.resolution is not distinct from old.resolution
    and new.created_at is not distinct from old.created_at
    and new.updated_at is not distinct from old.updated_at
    and (
      new.created_by is not distinct from old.created_by
      or (old.created_by is not null and new.created_by is null)
    )
    and (
      new.closed_by is not distinct from old.closed_by
      or (old.closed_by is not null and new.closed_by is null)
    )
    and (
      new.created_by is distinct from old.created_by
      or new.closed_by is distinct from old.closed_by
    ) then
    new.updated_at := old.updated_at;
    return new;
  end if;

  if old.activity_type <> 'case'
    or old.status <> 'raised'
    or new.activity_type <> 'case'
    or new.status <> 'closed' then
    raise exception using
      errcode = 'P0001',
      message = 'CRM activities are immutable except when closing a raised case.';
  end if;

  if new.id is distinct from old.id
    or new.crm_account_id is distinct from old.crm_account_id
    or new.subject is distinct from old.subject
    or new.notes is distinct from old.notes
    or new.priority is distinct from old.priority
    or new.occurred_at is distinct from old.occurred_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'A raised case cannot be rewritten while it is being closed.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists commerce_crm_activities_enforce_transition
on public.commerce_crm_activities;

create trigger commerce_crm_activities_enforce_transition
before update on public.commerce_crm_activities
for each row
execute function public.enforce_commerce_crm_activity_transition();

create or replace function public.commerce_crm_get_activity_stats ()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'calls',
    count(*) filter (where activity_type = 'call'),
    'raisedCases',
    count(*) filter (
      where activity_type = 'case'
        and status = 'raised'
    ),
    'closedCases',
    count(*) filter (
      where activity_type = 'case'
        and status = 'closed'
    )
  )
  from public.commerce_crm_activities;
$$;

alter table public.commerce_crm_activities enable row level security;

revoke all on table public.commerce_crm_activities
from public, anon, authenticated;

grant select, insert, update
on table public.commerce_crm_activities
to service_role;

revoke delete, truncate
on table public.commerce_crm_activities
from service_role;

revoke all on function public.enforce_commerce_crm_activity_transition ()
from public, anon, authenticated;

grant execute on function public.enforce_commerce_crm_activity_transition ()
to service_role;

revoke all on function public.commerce_crm_get_activity_stats ()
from public, anon, authenticated;

grant execute on function public.commerce_crm_get_activity_stats ()
to service_role;

-- Lightweight live storefront presence final-state delta.
create index if not exists store_analytics_sessions_external_last_seen_idx
on public.store_analytics_sessions (last_seen_at desc, visitor_id)
where is_internal = false;

create or replace function public.store_analytics_get_live_visitors (
  p_active_seconds integer default 180
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct visitor_id)::bigint
  from public.store_analytics_sessions
  where is_internal = false
    and last_seen_at >= now() - (
      greatest(
        60,
        least(coalesce(p_active_seconds, 180), 600)
      ) * interval '1 second'
    );
$$;

revoke all on function public.store_analytics_get_live_visitors (integer)
from public, anon, authenticated;

grant execute on function public.store_analytics_get_live_visitors (integer)
to service_role;

-- Product-review account-age eligibility final-state delta.
create or replace function public.enforce_product_review_account_eligibility ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_created_at timestamp with time zone;
begin
  select users.created_at
  into v_account_created_at
  from auth.users as users
  where users.id = new.user_id;

  if v_account_created_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_REVIEW_ACCOUNT_NOT_FOUND';
  end if;

  if v_account_created_at > pg_catalog.statement_timestamp() - interval '1 hour' then
    perform orders.id
    from public.customer_orders as orders
    where orders.user_id = new.user_id
      and orders.status in ('completed', 'delivered')
    limit 1
    for share;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'PRODUCT_REVIEW_ACCOUNT_TOO_NEW';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_reviews_enforce_account_eligibility
on public.product_reviews;

create trigger product_reviews_enforce_account_eligibility
before insert on public.product_reviews
for each row
execute function public.enforce_product_review_account_eligibility();

revoke all on function public.enforce_product_review_account_eligibility ()
from public, anon, authenticated;

-- Admin Documents final-state delta.
create or replace function public.default_admin_permissions ()
returns jsonb
language sql
immutable
as $$
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
    'reviews.view', false,
    'reviews.delete', false,
    'settings.view', false,
    'settings.edit', false,
    'settings.coupons', false,
    'users.view', false,
    'hr.view', false,
    'hr.edit', false,
    'treasury.view', false,
    'treasury.edit', false,
    'documents.view', false,
    'documents.manage', false
  );
$$;

update public.admin_users
set permissions = public.default_admin_permissions() || coalesce(permissions, '{}'::jsonb);

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null references public.document_folders (id) on delete cascade,
  name text not null,
  is_restricted boolean not null default false,
  created_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_folders_name_check check (
    char_length(btrim(name)) between 1 and 120
    and name !~ '[/\\]'
    and btrim(name) not in ('.', '..')
  )
);

create unique index if not exists document_folders_root_name_uidx
on public.document_folders (lower(name))
where parent_id is null;

create unique index if not exists document_folders_parent_name_uidx
on public.document_folders (parent_id, lower(name))
where parent_id is not null;

create index if not exists document_folders_parent_name_idx
on public.document_folders (parent_id, name);

create table if not exists public.document_folder_permissions (
  folder_id uuid not null references public.document_folders (id) on delete cascade,
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  access_level text not null default 'viewer',
  granted_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (folder_id, admin_user_id),
  constraint document_folder_permissions_access_check check (
    access_level in ('viewer', 'editor')
  )
);

create index if not exists document_folder_permissions_admin_idx
on public.document_folder_permissions (admin_user_id, folder_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid null references public.document_folders (id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_name_check check (
    char_length(btrim(name)) between 1 and 240
    and name !~ '[/\\]'
    and btrim(name) not in ('.', '..')
  ),
  constraint documents_size_check check (size_bytes >= 0)
);

create index if not exists documents_folder_updated_idx
on public.documents (folder_id, updated_at desc);

alter table public.document_folders enable row level security;
alter table public.document_folder_permissions enable row level security;
alter table public.documents enable row level security;

revoke all on table public.document_folders from anon, authenticated;
revoke all on table public.document_folder_permissions from anon, authenticated;
revoke all on table public.documents from anon, authenticated;

grant select, insert, update, delete on table public.document_folders to service_role;
grant select, insert, update, delete on table public.document_folder_permissions to service_role;
grant select, insert, update, delete on table public.documents to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'admin-documents',
  'admin-documents',
  false,
  26214400,
  null
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- PDC shipping final-state delta.

alter table public.customer_orders
add column if not exists payment_status text not null default 'pending',
add column if not exists paid_at timestamptz null,
add column if not exists shipping_review_status text not null default 'not_required';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_orders_payment_status_check'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
    add constraint customer_orders_payment_status_check
    check (payment_status in ('pending', 'paid', 'failed', 'refunded'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_orders_shipping_review_status_check'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
    add constraint customer_orders_shipping_review_status_check
    check (shipping_review_status in ('not_required', 'required', 'approved', 'rejected'));
  end if;
end;
$$;

create table if not exists public.shipping_provider_settings (
  id text primary key,
  display_name text not null,
  base_url text not null,
  company_id text not null,
  product_id integer not null,
  origin_city_id integer null,
  origin_address text null,
  origin_phone text null,
  origin_contact_name text null,
  default_weight_kg numeric(8, 3) not null default 1,
  shipment_type_id integer not null default 1,
  label_template_id integer not null default 1,
  allow_open_shipment boolean not null default false,
  all_must_valid boolean not null default true,
  is_enabled boolean not null default false,
  auto_create_labels boolean not null default false,
  access_token_encrypted text null,
  webhook_secret_encrypted text null,
  updated_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_provider_settings_id_check check (id = 'pdc'),
  constraint shipping_provider_settings_base_url_check check (
    base_url = 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/'
  ),
  constraint shipping_provider_settings_product_check check (product_id > 0),
  constraint shipping_provider_settings_weight_check check (default_weight_kg > 0),
  constraint shipping_provider_settings_shipment_type_check check (shipment_type_id in (1, 3, 5)),
  constraint shipping_provider_settings_template_check check (label_template_id > 0)
);

insert into public.shipping_provider_settings (
  id,
  display_name,
  base_url,
  company_id,
  product_id
)
values (
  'pdc',
  'PDC Courier',
  'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',
  '280533',
  40
)
on conflict (id) do nothing;

create table if not exists public.shipping_city_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pdc',
  provider_city_id integer not null,
  governorate text not null,
  city text not null,
  city_arabic text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_city_mappings_provider_check check (provider = 'pdc'),
  constraint shipping_city_mappings_city_id_check check (provider_city_id > 0)
);

create unique index if not exists shipping_city_mappings_provider_city_uidx
on public.shipping_city_mappings (provider, provider_city_id);

create unique index if not exists shipping_city_mappings_name_uidx
on public.shipping_city_mappings (provider, lower(governorate), lower(city));

create table if not exists public.shipping_status_mappings (
  provider text not null default 'pdc',
  provider_status_id integer not null,
  provider_label text not null,
  order_status text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, provider_status_id),
  constraint shipping_status_mappings_provider_check check (provider = 'pdc'),
  constraint shipping_status_mappings_order_status_check check (
    order_status is null or order_status in (
      'processing',
      'being_shipped',
      'out_for_delivery',
      'on_hold',
      'delivered',
      'cancelled'
    )
  )
);

insert into public.shipping_status_mappings (
  provider,
  provider_status_id,
  provider_label,
  order_status
)
values
  ('pdc', 2, 'Transfer To Branch', 'being_shipped'),
  ('pdc', 3, 'Received At Branch', 'being_shipped'),
  ('pdc', 4, 'Out For Delivery', 'out_for_delivery'),
  ('pdc', 5, 'Shipment Delivered', 'delivered'),
  ('pdc', 7, 'To Be Returned', 'on_hold'),
  ('pdc', 8, 'Returned To Shipper', 'cancelled'),
  ('pdc', 9, 'Shipment Lost', 'on_hold'),
  ('pdc', 10, 'Package Issue', 'on_hold'),
  ('pdc', 11, 'Re-Operate', 'processing'),
  ('pdc', 12, 'Picked Up', 'being_shipped'),
  ('pdc', 13, 'New Pickup', 'processing'),
  ('pdc', 14, 'Postponed', 'on_hold'),
  ('pdc', 15, 'Not Delivered', 'on_hold'),
  ('pdc', 19, 'Reschedule', 'on_hold'),
  ('pdc', 24, 'Partial Delivery', 'on_hold'),
  ('pdc', 77, 'Under Return Process', 'on_hold'),
  ('pdc', 82, 'In Transit', 'being_shipped'),
  ('pdc', 83, 'On The Way To Destination Hub', 'being_shipped'),
  ('pdc', 84, 'Received At Hub', 'being_shipped'),
  ('pdc', 85, 'Received At Destination Hub', 'being_shipped'),
  ('pdc', 87, 'In Transit - Undelivered', 'on_hold'),
  ('pdc', 88, 'In Transit To Destination Hub', 'being_shipped'),
  ('pdc', 89, 'In Transit - Undelivered', 'on_hold'),
  ('pdc', 90, 'In Transit - Undelivered', 'on_hold'),
  ('pdc', 91, 'Wrong Sort', 'on_hold'),
  ('pdc', 92, 'Unclear Address', 'on_hold'),
  ('pdc', 93, '3PL International Shipment', 'being_shipped'),
  ('pdc', 94, 'Hold At Warehouse', 'on_hold'),
  ('pdc', 95, 'On Hold', 'on_hold'),
  ('pdc', 96, 'Hold For Update', 'on_hold'),
  ('pdc', 97, 'Received At Hub', 'being_shipped'),
  ('pdc', 98, 'Received At Hub', 'being_shipped')
on conflict (provider, provider_status_id) do update
set
  provider_label = excluded.provider_label,
  order_status = excluded.order_status,
  updated_at = now();

create table if not exists public.shipping_order_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders (id) on delete cascade,
  provider text not null default 'pdc',
  state text not null default 'queued',
  to_ref text not null,
  awb text null,
  provider_status_id integer null,
  provider_status_name text null,
  provider_status_at timestamptz null,
  provider_reason_name text null,
  label_storage_path text null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_error text null,
  next_attempt_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_order_jobs_order_key unique (order_id),
  constraint shipping_order_jobs_ref_key unique (to_ref),
  constraint shipping_order_jobs_awb_key unique (awb),
  constraint shipping_order_jobs_provider_check check (provider = 'pdc'),
  constraint shipping_order_jobs_state_check check (
    state in ('queued', 'blocked', 'submitting', 'label_pending', 'ready', 'failed')
  ),
  constraint shipping_order_jobs_attempt_check check (attempt_count >= 0)
);

create index if not exists shipping_order_jobs_queue_idx
on public.shipping_order_jobs (state, next_attempt_at, created_at);

create table if not exists public.shipping_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pdc',
  event_key text not null,
  awb text not null,
  order_ref text not null,
  provider_status_id integer not null,
  provider_status_name text null,
  status_date timestamptz null,
  reason_name text null,
  payload jsonb not null,
  processed_at timestamptz null,
  processing_error text null,
  received_at timestamptz not null default now(),
  constraint shipping_webhook_events_key unique (provider, event_key),
  constraint shipping_webhook_events_provider_check check (provider = 'pdc')
);

create index if not exists shipping_webhook_events_order_idx
on public.shipping_webhook_events (order_ref, received_at desc);

create or replace function public.queue_paid_order_for_shipping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status <> 'paid' then
    return new;
  end if;

  if new.shipping_review_status not in ('not_required', 'approved') then
    return new;
  end if;

  if not exists (
    select 1
    from public.shipping_provider_settings as settings
    where settings.id = 'pdc'
      and settings.is_enabled = true
      and settings.auto_create_labels = true
  ) then
    return new;
  end if;

  insert into public.shipping_order_jobs (
    order_id,
    provider,
    state,
    to_ref,
    next_attempt_at,
    updated_at
  )
  values (
    new.id,
    'pdc',
    'queued',
    coalesce(nullif(btrim(new.order_number), ''), new.id::text),
    now(),
    now()
  )
  on conflict (order_id) do update
  set
    state = case
      when shipping_order_jobs.state in ('blocked', 'failed') then 'queued'
      else shipping_order_jobs.state
    end,
    next_attempt_at = case
      when shipping_order_jobs.state in ('blocked', 'failed') then now()
      else shipping_order_jobs.next_attempt_at
    end,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.queue_eligible_paid_orders_for_shipping()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_count integer := 0;
begin
  if not exists (
    select 1
    from public.shipping_provider_settings as settings
    where settings.id = 'pdc'
      and settings.is_enabled = true
      and settings.auto_create_labels = true
  ) then
    return 0;
  end if;

  insert into public.shipping_order_jobs (
    order_id,
    provider,
    state,
    to_ref,
    next_attempt_at,
    updated_at
  )
  select
    orders.id,
    'pdc',
    'queued',
    coalesce(nullif(btrim(orders.order_number), ''), orders.id::text),
    now(),
    now()
  from public.customer_orders as orders
  where orders.payment_status = 'paid'
    and orders.shipping_review_status in ('not_required', 'approved')
  on conflict (order_id) do update
  set
    state = case
      when shipping_order_jobs.state in ('blocked', 'failed') then 'queued'
      else shipping_order_jobs.state
    end,
    next_attempt_at = case
      when shipping_order_jobs.state in ('blocked', 'failed') then now()
      else shipping_order_jobs.next_attempt_at
    end,
    updated_at = now();

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

revoke all on function public.queue_paid_order_for_shipping()
from public, anon, authenticated;

revoke all on function public.queue_eligible_paid_orders_for_shipping()
from public, anon, authenticated;

grant execute on function public.queue_eligible_paid_orders_for_shipping()
to service_role;

drop trigger if exists customer_orders_queue_paid_shipping_insert
on public.customer_orders;

drop trigger if exists customer_orders_queue_paid_shipping_update
on public.customer_orders;

create trigger customer_orders_queue_paid_shipping_insert
after insert
on public.customer_orders
for each row
execute function public.queue_paid_order_for_shipping();

create trigger customer_orders_queue_paid_shipping_update
after update of
  payment_status,
  shipping_review_status,
  order_number,
  first_name,
  last_name,
  phone,
  street_address,
  city,
  governorate
on public.customer_orders
for each row
execute function public.queue_paid_order_for_shipping();

alter table public.shipping_provider_settings enable row level security;
alter table public.shipping_city_mappings enable row level security;
alter table public.shipping_status_mappings enable row level security;
alter table public.shipping_order_jobs enable row level security;
alter table public.shipping_webhook_events enable row level security;

revoke all on table public.shipping_provider_settings from public, anon, authenticated;
revoke all on table public.shipping_city_mappings from public, anon, authenticated;
revoke all on table public.shipping_status_mappings from public, anon, authenticated;
revoke all on table public.shipping_order_jobs from public, anon, authenticated;
revoke all on table public.shipping_webhook_events from public, anon, authenticated;

grant select, insert, update, delete on table public.shipping_provider_settings to service_role;
grant select, insert, update, delete on table public.shipping_city_mappings to service_role;
grant select, insert, update, delete on table public.shipping_status_mappings to service_role;
grant select, insert, update, delete on table public.shipping_order_jobs to service_role;
grant select, insert, update, delete on table public.shipping_webhook_events to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'shipping-labels',
  'shipping-labels',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;



insert into public.shipping_city_mappings (
  provider,
  provider_city_id,
  governorate,
  city,
  city_arabic
)
values
  ('pdc', 1, 'Cairo', 'Al Herafiyeen', 'الحرفيين'),
  ('pdc', 2, 'Cairo', 'Zamalek', 'الزمالك'),
  ('pdc', 3, 'Cairo', 'Boulak abul-Ela', 'بولاق أبو العلا'),
  ('pdc', 4, 'Cairo', 'Down Town', 'وسط البلد'),
  ('pdc', 5, 'Cairo', 'Garden City', 'جاردن سيتي'),
  ('pdc', 6, 'Cairo', 'Manial', 'المنيل'),
  ('pdc', 7, 'Cairo', 'Attaba', 'العتبه'),
  ('pdc', 8, 'Cairo', 'Qasr el-Einy', 'القصر العيني'),
  ('pdc', 9, 'Cairo', 'Dhaher', 'الظاهر'),
  ('pdc', 10, 'Cairo', 'Ramses', 'رمسيس'),
  ('pdc', 11, 'Cairo', 'Shoubra Masr', 'شبرا مصر'),
  ('pdc', 12, 'Cairo', 'Darrasa', 'الدراسة'),
  ('pdc', 13, 'Cairo', 'Abbassiya', 'العباسية'),
  ('pdc', 14, 'Cairo', 'Darb el-Ahmar', 'الدرب الأحمر'),
  ('pdc', 15, 'Cairo', 'Bab el-Shiriya', 'باب الشعرية'),
  ('pdc', 16, 'Cairo', 'Sayeda Zeinab', 'السيدة زينب'),
  ('pdc', 17, 'Cairo', 'Old Cairo', 'مصر القديمة'),
  ('pdc', 18, 'Cairo', 'Nasr City', 'مدينة نصر'),
  ('pdc', 19, 'Cairo', '10th District', 'الحى العاشر'),
  ('pdc', 20, 'Cairo', 'Heliopolis', 'مصر الجديدة'),
  ('pdc', 21, 'Cairo', 'Gesr el-Suez', 'جسر السويس'),
  ('pdc', 22, 'Cairo', 'Alf Maskan', 'الألف مسكن'),
  ('pdc', 23, 'Cairo', 'Obour Buildings', 'عمارات العبور'),
  ('pdc', 24, 'Cairo', 'Ard el-Golf', 'ارض الجولف'),
  ('pdc', 25, 'Cairo', 'Hadayek el-Qobba', 'حدائق القبة'),
  ('pdc', 26, 'Cairo', 'Zaytoun', 'الزيتون'),
  ('pdc', 27, 'Cairo', 'Ameeriya', 'الأميرية'),
  ('pdc', 28, 'Cairo', 'Matariya', 'المطرية'),
  ('pdc', 29, 'Cairo', 'Ain Shams', 'عين شمس'),
  ('pdc', 30, 'Cairo', 'New Maadi', 'المعادي الجديدة'),
  ('pdc', 31, 'Cairo', 'Dar el-Salam', 'دار السلام'),
  ('pdc', 32, 'Cairo', 'Maadi', 'المعادي'),
  ('pdc', 33, 'Cairo', 'Moqattam', 'المقطم'),
  ('pdc', 34, 'Cairo', 'El-Hadaba el-Sofla', 'الهضبة السفلى'),
  ('pdc', 35, 'Cairo', 'Tora', 'طرة'),
  ('pdc', 36, 'Cairo', 'Maasara', 'المعصرة'),
  ('pdc', 37, 'Cairo', 'Helwan', 'حلوان'),
  ('pdc', 38, 'Cairo', 'Kotsica', 'كوتسيكا'),
  ('pdc', 39, 'Cairo', 'Qattamiya', 'القطامية'),
  ('pdc', 40, 'Cairo', 'New Cairo', 'التجمع'),
  ('pdc', 41, 'Cairo', 'El Rehab', 'الرحاب'),
  ('pdc', 42, 'Cairo', 'Madinty', 'مدينتى'),
  ('pdc', 43, 'Cairo', 'Cairo Airport', 'مطار القاهرة'),
  ('pdc', 44, 'Cairo', 'Salam City', 'مدينة السلام'),
  ('pdc', 45, 'Cairo', 'Obour City', 'مدينة العبور'),
  ('pdc', 46, 'Cairo', 'Ezbet el-Haganna', 'عزبة الهجانة'),
  ('pdc', 47, 'Cairo', 'Tibeen', 'التبين'),
  ('pdc', 48, 'Cairo', '15th of May City', 'مدينة 15 مايو'),
  ('pdc', 49, 'Cairo', 'Badr City', 'مدينة بدر'),
  ('pdc', 50, 'Cairo', 'Shourouq City', 'الشروق'),
  ('pdc', 51, 'Giza', 'Dokki', 'الدقي'),
  ('pdc', 52, 'Giza', 'Mohandiseen', 'المهندسين'),
  ('pdc', 53, 'Giza', 'Agouza', 'العجوزة'),
  ('pdc', 54, 'Giza', 'Ard-el-Lewa', 'ارض اللواء'),
  ('pdc', 55, 'Giza', 'Matar Imbaba', 'مطار امبابه'),
  ('pdc', 56, 'Giza', 'Saft-e-Laban', 'صفط اللبن'),
  ('pdc', 57, 'Giza', 'Imbaba', 'امبابة'),
  ('pdc', 58, 'Giza', 'Warraq', 'الوراق'),
  ('pdc', 59, 'Giza', 'Bashteel', 'بشتيل'),
  ('pdc', 60, 'Giza', 'Boulak-e-Dakrour', 'بولاق الدكرور'),
  ('pdc', 61, 'Giza', 'Giza', 'الجيزة'),
  ('pdc', 62, 'Giza', 'Faisal', 'فيصل'),
  ('pdc', 63, 'Giza', 'Haram', 'الهرم'),
  ('pdc', 64, 'Giza', 'Monieb', 'المنيب'),
  ('pdc', 65, 'Giza', 'Ahram Gardens', 'حدائق الأهرام'),
  ('pdc', 66, 'Giza', 'Rimaya', 'الرماية'),
  ('pdc', 67, 'Giza', '6th of October', 'مدينة 6 أكتوبر'),
  ('pdc', 68, 'Giza', 'Sheikh Zayed', 'مدينة الشيخ زايد'),
  ('pdc', 69, 'Giza', 'Wahat Road', 'طريق الواحات'),
  ('pdc', 70, 'Giza', 'Alex desert road till KM 28', 'طريق إسكندرية الصحراوى حتى ك 28'),
  ('pdc', 71, 'Giza', 'Smart Village', 'القرية الذكية'),
  ('pdc', 72, 'Giza', 'Nahiya', 'ناهيا البلد'),
  ('pdc', 73, 'Giza', 'Kafr Hakeem', 'كفر حكيم'),
  ('pdc', 74, 'Giza', 'Abu Rawash', 'أبو رواش'),
  ('pdc', 75, 'Giza', 'Saqqara', 'سقارة'),
  ('pdc', 76, 'Giza', 'Manial Sheeha', 'منيل شيحة'),
  ('pdc', 77, 'Giza', 'El-Manawat', 'المنوات'),
  ('pdc', 78, 'Alexandria', 'Sidi Gaber', 'سيدي جابر'),
  ('pdc', 79, 'Alexandria', 'Moharram Bek', 'محرم بك'),
  ('pdc', 80, 'Alexandria', 'Mina El-Basal', 'مينا البصل'),
  ('pdc', 81, 'Alexandria', 'Al Raml', 'الرمل'),
  ('pdc', 82, 'Alexandria', 'Al Montaza', 'المنتزه'),
  ('pdc', 83, 'Alexandria', 'Al Mansheya', 'المنشية'),
  ('pdc', 84, 'Alexandria', 'Al Labban', 'اللبان'),
  ('pdc', 85, 'Alexandria', 'Qetaa Maryout', 'قطاع مريوط'),
  ('pdc', 86, 'Alexandria', 'Qetaa at Tarik Al Sahrawi', 'قطاع الطريق الصحراوي'),
  ('pdc', 87, 'Alexandria', 'Bab Sharqi', 'باب شرقي'),
  ('pdc', 88, 'Alexandria', 'Al Gomrok', 'الجمرك'),
  ('pdc', 89, 'Alexandria', 'Al Attarin', 'العطارين'),
  ('pdc', 90, 'Alexandria', 'New Borg Al Arab', 'برج العرب الجديدة'),
  ('pdc', 91, 'Alexandria', 'Karmouz', 'كرموز'),
  ('pdc', 92, 'Alexandria', 'Al king maryout (Sharq & Gharb)', 'كينج مريوط (شرق وغرب)'),
  ('pdc', 93, 'Alexandria', 'Dekhela', 'الدخيلة'),
  ('pdc', 94, 'Alexandria', 'Borg Al Arab', 'برج العرب'),
  ('pdc', 95, 'Alexandria', 'Alexandria Desert', 'الطريق الصحراوي'),
  ('pdc', 96, 'Alexandria', 'Al Amaria First', 'العامرية أول'),
  ('pdc', 97, 'Alexandria', 'Al Daerah Al Gomrokeyah', 'الدائرة الجمركية'),
  ('pdc', 98, 'Alexandria 2', 'North Coast', 'الساحل الشمالي'),
  ('pdc', 99, 'Al Behaira', 'Shabrakhit', 'شبراخيت'),
  ('pdc', 100, 'Al Behaira', 'Rashid', 'رشيد'),
  ('pdc', 101, 'Al Behaira', 'Mahmoudiyah', 'المحمودية'),
  ('pdc', 102, 'Al Behaira', 'Kom Hamada', 'كوم حمادة'),
  ('pdc', 103, 'Al Behaira', 'Kafr Al Dawwar', 'كفر الدوار'),
  ('pdc', 104, 'Al Behaira', 'Itay Al Baroud', 'إيتاي البارود'),
  ('pdc', 105, 'Al Behaira', 'Hosh Issa', 'حوش عيسى'),
  ('pdc', 106, 'Al Behaira', 'Edco', 'إدكو'),
  ('pdc', 107, 'Al Behaira', 'Damanhour', 'دمنهور'),
  ('pdc', 108, 'Al Behaira', 'Badr', 'بدر'),
  ('pdc', 109, 'Al Behaira', 'Al delengaat', 'الدلنجات'),
  ('pdc', 110, 'Al Behaira', 'Al Rahmaniyah', 'الرحمانية'),
  ('pdc', 111, 'Al Behaira', 'Al Nubaria al-gedida', 'النوبارية الجديدة'),
  ('pdc', 112, 'Al Behaira', 'Al Behaira', 'البحيرة'),
  ('pdc', 113, 'Al Behaira', 'Abu Hummus', 'أبو حمص'),
  ('pdc', 114, 'Al Behaira', 'Abu al-Matamir', 'أبو المطامير'),
  ('pdc', 115, 'Al Behaira', 'Wadi', 'وادي'),
  ('pdc', 116, 'Al Mounofia', 'Tella', 'تلا'),
  ('pdc', 117, 'Al Mounofia', 'Shebeen Alkom', 'شبين الكوم'),
  ('pdc', 118, 'Al Mounofia', 'Sarss', 'سرس'),
  ('pdc', 119, 'Al Mounofia', 'Qwessna', 'قويسنا'),
  ('pdc', 120, 'Al Mounofia', 'Menouf', 'منوف'),
  ('pdc', 121, 'Al Mounofia', 'Hay Sharq', 'حي شرق'),
  ('pdc', 122, 'Al Mounofia', 'Hay Gharb', 'حي غرب'),
  ('pdc', 123, 'Al Mounofia', 'Ashmoun', 'أشمون'),
  ('pdc', 124, 'Al Mounofia', 'Al shouhdaa', 'الشهداء'),
  ('pdc', 125, 'Al Mounofia', 'Al sadat', 'السادات'),
  ('pdc', 126, 'Al Mounofia', 'Al bagour', 'الباجور'),
  ('pdc', 127, 'Algharbia', 'Al Mahalla el', 'المحلة'),
  ('pdc', 128, 'Algharbia', 'Tanta', 'طنطا'),
  ('pdc', 129, 'Algharbia', 'Kafr Al Zayat', 'كفر الزيات'),
  ('pdc', 130, 'Algharbia', 'Samannoud', 'سمنود'),
  ('pdc', 131, 'Algharbia', 'Zifta', 'زفتى'),
  ('pdc', 132, 'Algharbia', 'Basyoun', 'بسيون'),
  ('pdc', 133, 'Algharbia', 'Desouk', 'دسوق'),
  ('pdc', 134, 'Dakhahlia', 'Tami Alamdid', 'تمي الأمديد'),
  ('pdc', 135, 'Dakhahlia', 'Talkha', 'طلخا'),
  ('pdc', 136, 'Dakhahlia', 'Sherbeen', 'شربين'),
  ('pdc', 137, 'Dakhahlia', 'Meniat Al Nassr', 'منية النصر'),
  ('pdc', 138, 'Dakhahlia', 'Meit Ghamr', 'ميت غمر'),
  ('pdc', 139, 'Dakhahlia', 'Meit Salseil', 'ميت سلسيل'),
  ('pdc', 140, 'Dakhahlia', 'Mahla Demna', 'محلة دمنة'),
  ('pdc', 141, 'Dakhahlia', 'Gamassa', 'جمصة'),
  ('pdc', 142, 'Dakhahlia', 'Dekerness', 'دكرنس'),
  ('pdc', 143, 'Dakhahlia', 'Dakhahlia', 'الدقهلية'),
  ('pdc', 144, 'Dakhahlia', 'Belqass', 'بلقاس'),
  ('pdc', 145, 'Dakhahlia', 'Bani Ebeid', 'بني عبيد'),
  ('pdc', 146, 'Dakhahlia', 'Banbro', 'منية النصر'),
  ('pdc', 147, 'Dakhahlia', 'Al senbelaween', 'السنبلاوين'),
  ('pdc', 148, 'Dakhahlia', 'Al matria', 'المطرية'),
  ('pdc', 149, 'Dakhahlia', 'Al gamlia', 'الجمالية'),
  ('pdc', 150, 'Dakhahlia', 'Al Qourdi', 'الكردي'),
  ('pdc', 151, 'Dakhahlia', 'Al Manzala', 'المنزلة'),
  ('pdc', 152, 'Dakhahlia', 'Al Mansoura', 'المنصورة'),
  ('pdc', 153, 'Dakhahlia', 'Aga', 'أجا'),
  ('pdc', 154, 'Dammitta', 'Rass Al Bar', 'رأس البر'),
  ('pdc', 155, 'Dammitta', 'Meet Abu Ghaleb', 'ميت أبو غالب'),
  ('pdc', 156, 'Dammitta', 'Kafr Saad', 'كفر سعد'),
  ('pdc', 157, 'Dammitta', 'Kafr Albatekh', 'كفر البطيخ'),
  ('pdc', 158, 'Dammitta', 'Faraskour', 'فارسكور'),
  ('pdc', 159, 'Dammitta', 'Ezbat Al Borg', 'عزبة البرج'),
  ('pdc', 160, 'Dammitta', 'Damietta  Al Gedida', 'دمياط الجديدة'),
  ('pdc', 161, 'Dammitta', 'Dammitta', 'دمياط'),
  ('pdc', 162, 'Dammitta', 'Al zarqa', 'الزرقا'),
  ('pdc', 163, 'Dammitta', 'Al rawda', 'الروضة'),
  ('pdc', 164, 'Dammitta', 'Al Serou', 'السرو'),
  ('pdc', 165, 'Elsharqia', 'Zaqazeq', 'الزقازيق'),
  ('pdc', 166, 'Elsharqia', 'San Al Hagar Alqeblia', 'صان الحجر القبلية'),
  ('pdc', 167, 'Elsharqia', 'Monshaet Abu Omar', 'منشأة أبو عمر'),
  ('pdc', 168, 'Elsharqia', 'Menia Al Qamh', 'منيا القمح'),
  ('pdc', 169, 'Elsharqia', 'Mashtoul Alsouk', 'مشتول السوق'),
  ('pdc', 170, 'Elsharqia', 'Kafr Sakr', 'كفر صقر'),
  ('pdc', 171, 'Elsharqia', 'Hehia', 'ههيا'),
  ('pdc', 172, 'Elsharqia', 'faqouss', 'فاقوس'),
  ('pdc', 173, 'Elsharqia', 'Derb Negm', 'ديرب نجم'),
  ('pdc', 174, 'Elsharqia', 'Belbass', 'بلبيس'),
  ('pdc', 175, 'Elsharqia', 'Awlaad sakr', 'أولاد صقر'),
  ('pdc', 176, 'Elsharqia', 'Alsalhia Algedieda', 'الصالحية الجديدة'),
  ('pdc', 177, 'Elsharqia', 'Alqarein', 'القرين'),
  ('pdc', 178, 'Elsharqia', 'Alqaniaat', 'القنايات'),
  ('pdc', 179, 'Elsharqia', 'Al Ibrahemia', 'الإبراهيمية'),
  ('pdc', 180, 'Elsharqia', 'Al Hussania', 'الحسينية'),
  ('pdc', 181, 'Elsharqia', 'Abu Kbeir', 'أبو كبير'),
  ('pdc', 182, 'Elsharqia', 'Abu Hamaad', 'أبو حماد'),
  ('pdc', 183, 'Elsharqia', '10th of Ramadan city', 'مدينة العاشر من رمضان'),
  ('pdc', 184, 'Elsharqia', 'Elsharqia', 'الشرقية'),
  ('pdc', 185, 'Ismalia', 'Qantara Sharq', 'القنطرة شرق'),
  ('pdc', 186, 'Ismalia', 'Ismalia', 'الإسماعيلية'),
  ('pdc', 187, 'Ismalia', 'Fayed', 'فايد'),
  ('pdc', 188, 'Ismalia', 'alqasaasayn', 'القصاصين'),
  ('pdc', 189, 'Ismalia', 'Alahyaa Alawal Althany - Althaless', 'الأحياء الأول والثاني والثالث'),
  ('pdc', 190, 'Ismalia', 'Al Tall Al Kbier', 'التل الكبير'),
  ('pdc', 191, 'Ismalia', 'Abu Sir', 'أبو صوير'),
  ('pdc', 192, 'kafr Al Sheikh', 'Sedi Salem', 'سيدي سالم'),
  ('pdc', 193, 'kafr Al Sheikh', 'Sedi Ghazi', 'سيدي غازي'),
  ('pdc', 194, 'kafr Al Sheikh', 'Qeleen', 'قلين'),
  ('pdc', 195, 'kafr Al Sheikh', 'Matobus', 'مطوبس'),
  ('pdc', 196, 'kafr Al Sheikh', 'Masseir', 'مسير'),
  ('pdc', 197, 'kafr Al Sheikh', 'Massef Balteem', 'مصيف بلطيم'),
  ('pdc', 198, 'kafr Al Sheikh', 'Kafr Al-sheikh', 'كفر الشيخ'),
  ('pdc', 199, 'kafr Al Sheikh', 'Fewa', 'فوه'),
  ('pdc', 200, 'kafr Al Sheikh', 'Borg Al Broloss', 'برج البرلس'),
  ('pdc', 201, 'kafr Al Sheikh', 'Bella', 'بيلا'),
  ('pdc', 202, 'kafr Al Sheikh', 'Balteem', 'بلطيم'),
  ('pdc', 203, 'kafr Al Sheikh', 'Al reyad', 'الرياض'),
  ('pdc', 204, 'kafr Al Sheikh', 'Al hamoul', 'الحامول'),
  ('pdc', 205, 'Port Said', 'Port Said', 'بورسعيد'),
  ('pdc', 206, 'Port Said', 'Port Fouad', 'بورفؤاد'),
  ('pdc', 207, 'Port Said', 'Sharq-e-Tafrea''a', 'شرق التفريعة'),
  ('pdc', 208, 'Qalyubia', 'Toukh', 'طوخ'),
  ('pdc', 209, 'Qalyubia', 'Shoubra Alkhaima', 'شبرا الخيمة'),
  ('pdc', 210, 'Qalyubia', 'Shebeen Alqanater', 'شبين القناطر'),
  ('pdc', 211, 'Qalyubia', 'Qaliub', 'قليوب'),
  ('pdc', 212, 'Qalyubia', 'Qaha', 'قها'),
  ('pdc', 213, 'Qalyubia', 'Kanater Khairia', 'القناطر الخيرية'),
  ('pdc', 214, 'Qalyubia', 'Kafr Shoukr', 'كفر شكر'),
  ('pdc', 215, 'Qalyubia', 'Banha', 'بنها'),
  ('pdc', 216, 'Qalyubia', 'Alobour', 'العبور'),
  ('pdc', 217, 'Qalyubia', 'Alkhanka', 'الخانكة'),
  ('pdc', 218, 'Qalyubia', 'Al Khousoss', 'الخصوص'),
  ('pdc', 219, 'Qalyubia', 'Qalyubia', 'القليوبية'),
  ('pdc', 220, 'Suez', 'Suez', 'السويس'),
  ('pdc', 221, 'Suez', 'Al Soukhna', 'السخنة'),
  ('pdc', 222, 'Suez', 'El Ganayen', 'الجناين'),
  ('pdc', 223, 'Alfayoum', 'Youssef Alsedeik', 'يوسف الصديق'),
  ('pdc', 224, 'Alfayoum', 'waadi al rayaan', 'وادي الريان'),
  ('pdc', 225, 'Alfayoum', 'Tamiea', 'طامية'),
  ('pdc', 226, 'Alfayoum', 'Snourss', 'سنورس'),
  ('pdc', 227, 'Alfayoum', 'madinat alfayuwm aljadida', 'مدينة الفيوم الجديدة'),
  ('pdc', 228, 'Alfayoum', 'Itsa', 'إطسا'),
  ('pdc', 229, 'Alfayoum', 'Abshuaa', 'إبشواي'),
  ('pdc', 230, 'Alfayoum', 'Alfayoum', 'الفيوم'),
  ('pdc', 231, 'Assiut', 'Sahel Seleim', 'ساحل سليم'),
  ('pdc', 232, 'Assiut', 'Sadfaa', 'صدفا'),
  ('pdc', 233, 'Assiut', 'Manfalout', 'منفلوط'),
  ('pdc', 234, 'Assiut', 'Dairout', 'ديروط'),
  ('pdc', 235, 'Assiut', 'Assiut Algedida', 'أسيوط الجديدة'),
  ('pdc', 236, 'Assiut', 'Assiut', 'أسيوط'),
  ('pdc', 237, 'Assiut', 'Alzaheir Alsahrawy', 'الظهير الصحراوي'),
  ('pdc', 238, 'Assiut', 'Alqossya', 'القوصية'),
  ('pdc', 239, 'Assiut', 'Alghaniem', 'الغنايم'),
  ('pdc', 240, 'Assiut', 'Alfath', 'الفتح'),
  ('pdc', 241, 'Assiut', 'Albadry', 'البداري'),
  ('pdc', 242, 'Assiut', 'Abu Teih', 'أبو تيج'),
  ('pdc', 243, 'Assiut', 'Abnoob', 'أبنوب'),
  ('pdc', 244, 'Beni Suef', 'Smastta', 'سمسطا'),
  ('pdc', 245, 'Beni Suef', 'Nasser', 'ناصر'),
  ('pdc', 246, 'Beni Suef', 'Ihnassya', 'إهناسيا'),
  ('pdc', 247, 'Beni Suef', 'Ben Suief Algedida', 'بني سويف الجديدة'),
  ('pdc', 248, 'Beni Suef', 'Ben Suief', 'بني سويف'),
  ('pdc', 249, 'Beni Suef', 'Biba', 'ببا'),
  ('pdc', 250, 'Beni Suef', 'Alwastta', 'الواسطي'),
  ('pdc', 251, 'Beni Suef', 'Alfeshin', 'الفشن'),
  ('pdc', 252, 'El Menia', 'Samalout', 'سمالوط'),
  ('pdc', 253, 'El Menia', 'Mattay', 'مطاي'),
  ('pdc', 254, 'El Menia', 'Malawy', 'ملوي'),
  ('pdc', 255, 'El Menia', 'Maghagha', 'مغاغة'),
  ('pdc', 256, 'El Menia', 'El Menia  Algedida', 'المنيا الجديدة'),
  ('pdc', 257, 'El Menia', 'El Menia', 'المنيا'),
  ('pdc', 258, 'El Menia', 'Dirmouass', 'ديرمواس'),
  ('pdc', 259, 'El Menia', 'Bani Mazar', 'بني مزار'),
  ('pdc', 260, 'El Menia', 'Aladwa', 'العدوة'),
  ('pdc', 261, 'El Menia', 'Abu Qorqass', 'أبو قرقاص'),
  ('pdc', 262, 'Aswan', 'New toushka City', 'توشكى الجديدة'),
  ('pdc', 263, 'Aswan', 'New Aswan City', 'أسوان الجديدة'),
  ('pdc', 264, 'Aswan', 'Nassr Alnouba', 'نصر النوبة'),
  ('pdc', 265, 'Aswan', 'Kom Ambo', 'كوم أمبو'),
  ('pdc', 266, 'Aswan', 'Kalabsha', 'كلابشة'),
  ('pdc', 267, 'Aswan', 'Edfo', 'إدفو'),
  ('pdc', 268, 'Aswan', 'Drawo', 'دراو'),
  ('pdc', 269, 'Aswan', 'Aswan', 'أسوان'),
  ('pdc', 270, 'Aswan', 'Alsabaia', 'السباعية'),
  ('pdc', 271, 'Aswan', 'Albesaila', 'البصيلية'),
  ('pdc', 272, 'Aswan', 'Al Radessa', 'الرديسية'),
  ('pdc', 273, 'Aswan', 'Abu Sembal Alsayhia', 'أبو سمبل السياحية'),
  ('pdc', 274, 'Aswan', 'Abu Sembal', 'أبو سمبل'),
  ('pdc', 275, 'Aswan', 'Toshka', 'توشكى'),
  ('pdc', 276, 'Luxor', 'Teiba Algedida', 'طيبة الجديدة'),
  ('pdc', 277, 'Luxor', 'Luxor Algedida', 'الأقصر الجديدة'),
  ('pdc', 278, 'Luxor', 'Luxor', 'الأقصر'),
  ('pdc', 279, 'Luxor', 'Issna', 'إسنا'),
  ('pdc', 280, 'Luxor', 'Armant', 'أرمنت'),
  ('pdc', 281, 'Luxor', 'Altoud', 'الطود'),
  ('pdc', 282, 'Luxor', 'Alqarna', 'القرنة'),
  ('pdc', 283, 'Luxor', 'Al Zeinya', 'الزينية'),
  ('pdc', 284, 'Luxor', 'Al bayada', 'البياضية'),
  ('pdc', 285, 'Qena', 'Quoss', 'قوص'),
  ('pdc', 286, 'Qena', 'Qena Algedida', 'قنا الجديدة'),
  ('pdc', 287, 'Qena', 'Qena', 'قنا'),
  ('pdc', 288, 'Qena', 'Qaft', 'قفط'),
  ('pdc', 289, 'Qena', 'Naqada', 'نقادة'),
  ('pdc', 290, 'Qena', 'Naga Hamadi', 'نجع حمادي'),
  ('pdc', 291, 'Qena', 'Farshout', 'فرشوط'),
  ('pdc', 292, 'Qena', 'Dashna', 'دشنا'),
  ('pdc', 293, 'Qena', 'Alwakf', 'الوقف'),
  ('pdc', 294, 'Qena', 'Abu tesht', 'أبو تشت'),
  ('pdc', 295, 'Red Sea', 'Safaja', 'سفاجا'),
  ('pdc', 296, 'Red Sea', 'Ras Gharib', 'رأس غارب'),
  ('pdc', 297, 'Red Sea', 'Marsa Allam', 'مرسى علم'),
  ('pdc', 298, 'Red Sea', 'Hurghada', 'الغردقة'),
  ('pdc', 299, 'Red Sea', 'Halyeb', 'حلايب'),
  ('pdc', 300, 'Red Sea', 'Alqussier', 'القصير'),
  ('pdc', 301, 'Red Sea', 'Al shalatten', 'الشلاتين'),
  ('pdc', 302, 'Red Sea', 'Red Sea', 'البحر الأحمر'),
  ('pdc', 303, 'Sohag', 'Tama', 'طما'),
  ('pdc', 304, 'Sohag', 'Tahtaa', 'طهطا'),
  ('pdc', 305, 'Sohag', 'Suhag', 'سوهاج'),
  ('pdc', 306, 'Sohag', 'Saqalta', 'ساقلتة'),
  ('pdc', 307, 'Sohag', 'Hay Alqawssar', 'حي الكوثر'),
  ('pdc', 308, 'Sohag', 'Gouhaina', 'جهينة'),
  ('pdc', 309, 'Sohag', 'Gerga', 'جرجا'),
  ('pdc', 310, 'Sohag', 'Dar Alsalam', 'دار السلام'),
  ('pdc', 311, 'Sohag', 'Al manshaa', 'المنشأة'),
  ('pdc', 312, 'Sohag', 'Al Maragha', 'المراغة'),
  ('pdc', 313, 'Sohag', 'Al Ballena', 'البلينا'),
  ('pdc', 314, 'Sohag', 'Akhmiem', 'أخميم'),
  ('pdc', 315, 'New Valley', 'Paris', 'باريس'),
  ('pdc', 316, 'New Valley', 'Pallat', 'بلاط'),
  ('pdc', 317, 'New Valley', 'Mout', 'موط'),
  ('pdc', 318, 'New Valley', 'Al kharga', 'الخارجة'),
  ('pdc', 319, 'New Valley', 'Al Farafra', 'الفرافرة'),
  ('pdc', 320, 'New Valley', 'Siwa', 'سيوة'),
  ('pdc', 321, 'New Valley', 'Kharja Oases', 'واحة الخارجة'),
  ('pdc', 322, 'New Valley', 'Dakhla Oases', 'واحة الداخلة'),
  ('pdc', 323, 'Matrouh', 'North Coast Above 90Km', 'الساحل الشمالي فوق 90 كم'),
  ('pdc', 324, 'Matrouh', 'Um Alrekhim', 'أم الرخم'),
  ('pdc', 325, 'Matrouh', 'Sidi Heneish', 'سيدي حنيش'),
  ('pdc', 326, 'Matrouh', 'Ras Alhikma', 'رأس الحكمة'),
  ('pdc', 327, 'Matrouh', 'Kashuk Emaara', 'كشك عمارة'),
  ('pdc', 328, 'Matrouh', 'Halazein', 'الحلازين'),
  ('pdc', 329, 'Matrouh', 'Awlad Marii', 'أولاد مري'),
  ('pdc', 330, 'Matrouh', 'Atnouh', 'أتنوح'),
  ('pdc', 331, 'Matrouh', 'Al zayat', 'الزيات'),
  ('pdc', 332, 'Matrouh', 'Al suynat', 'السوينات'),
  ('pdc', 333, 'Matrouh', 'Al salom', 'السلام'),
  ('pdc', 334, 'Matrouh', 'Al qawasim', 'القواسم'),
  ('pdc', 335, 'Matrouh', 'Al qasr', 'القصر'),
  ('pdc', 336, 'Matrouh', 'Al oush', 'العوش'),
  ('pdc', 337, 'Matrouh', 'Al nasr', 'النصر'),
  ('pdc', 338, 'Matrouh', 'Al grawla', 'الجراولة'),
  ('pdc', 339, 'Matrouh', 'Al dakhla', 'الداخلة'),
  ('pdc', 340, 'Matrouh', 'Abuluho Alganouby', 'أبو لحو الجنوبي'),
  ('pdc', 341, 'Matrouh', 'Abuluho Albahri', 'أبو لحو البحري'),
  ('pdc', 342, 'Matrouh', 'Abu Mareiq', 'أبو مريق'),
  ('pdc', 343, 'Matrouh', 'Matrouh', 'مطروح'),
  ('pdc', 344, 'Matrouh', 'Al Hammam', 'الحمام'),
  ('pdc', 345, 'Matrouh', 'Al almeen', 'العلمين'),
  ('pdc', 346, 'Matrouh', 'Brani', 'براني'),
  ('pdc', 347, 'Matrouh', 'Negela', 'النجيلة'),
  ('pdc', 348, 'Matrouh', 'Salloum', 'السلوم'),
  ('pdc', 349, 'North Seina', 'Rafah', 'رفح'),
  ('pdc', 350, 'North Seina', 'Bir Alabd', 'بئر العبد'),
  ('pdc', 351, 'North Seina', 'Al sheikh Zwayd', 'الشيخ زويد'),
  ('pdc', 352, 'North Seina', 'Al nakhl', 'النخل'),
  ('pdc', 353, 'North Seina', 'Al hassana', 'الحسنة'),
  ('pdc', 354, 'North Seina', 'Al Aresh', 'العريش'),
  ('pdc', 355, 'North Seina', 'North Sinai', 'شمال سيناء'),
  ('pdc', 356, 'South Seina', 'Tor Sinai', 'طور سيناء'),
  ('pdc', 357, 'South Seina', 'Taba', 'طابا'),
  ('pdc', 358, 'South Seina', 'Sharm Alsheikh', 'شرم الشيخ'),
  ('pdc', 359, 'South Seina', 'Saint Katreen', 'سانت كاترين'),
  ('pdc', 360, 'South Seina', 'Rass Sudr', 'رأس سدر'),
  ('pdc', 361, 'South Seina', 'Nwabea', 'نويبع'),
  ('pdc', 362, 'South Seina', 'Dahab', 'دهب'),
  ('pdc', 363, 'South Seina', 'Abu Zeniema', 'أبو زنيمة'),
  ('pdc', 364, 'South Seina', 'Abu Redeis', 'أبو رديس'),
  ('pdc', 365, 'South Seina', 'South Sinai', 'جنوب سيناء'),
  ('pdc', 366, 'Cairo 2', 'Others', 'أخرى'),
  ('pdc', 367, 'Cairo 2', 'New capital', 'العاصمة الإدارية الجديدة'),
  ('pdc', 368, 'Cairo 2', 'Manshiat Nasr', 'منشأة ناصر'),
  ('pdc', 369, 'Cairo 2', 'Al Waily', 'الوايلي'),
  ('pdc', 370, 'Cairo 2', 'Al Marg', 'المرج'),
  ('pdc', 371, 'Cairo 2', 'Al Zawya Elhamra', 'الزاوية الحمراء'),
  ('pdc', 372, 'Giza 2', 'Al badrasheen', 'البدرشين'),
  ('pdc', 373, 'Giza 2', 'Kerdassa', 'كرداسة'),
  ('pdc', 374, 'Giza 2', 'Al Hawamdia', 'الحوامدية'),
  ('pdc', 375, 'Giza 2', 'Al Wahat city', 'مدينة الواحات'),
  ('pdc', 376, 'Giza 2', 'Atfeh', 'أطفيح'),
  ('pdc', 377, 'Giza 2', 'Alsaff', 'الصف'),
  ('pdc', 378, 'Giza 2', 'Monshaet Alqanater', 'منشأة القناطر'),
  ('pdc', 379, 'Giza 2', 'Alayaat', 'العياط'),
  ('pdc', 380, 'Giza 2', 'Awssem', 'أوسيم'),
  ('pdc', 381, 'Giza 2', 'Abo AlNomross', 'أبو النمرس'),
  ('pdc', 382, 'Giza 2', 'Al barageel', 'البراجيل')
on conflict (provider, provider_city_id) do update
set
  governorate = excluded.governorate,
  city = excluded.city,
  city_arabic = excluded.city_arabic,
  updated_at = now();
