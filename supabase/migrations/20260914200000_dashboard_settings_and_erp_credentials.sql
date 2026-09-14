begin;

alter table public.site_settings
  add column if not exists hero_rotation_seconds integer not null default 5,
  add column if not exists banner_ad_1_enabled boolean not null default true,
  add column if not exists banner_ad_2_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_hero_rotation_seconds_check'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
      add constraint site_settings_hero_rotation_seconds_check
      check (hero_rotation_seconds >= 1);
  end if;
end;
$$;

create table if not exists public.erp_provider_settings (
  id text primary key,
  account_url text not null,
  api_key_encrypted text not null,
  client_id_encrypted text null,
  updated_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint erp_provider_settings_id_check check (id = 'daftra'),
  constraint erp_provider_settings_account_url_check check (account_url ~ '^https://[^/]+$')
);

alter table public.erp_provider_settings enable row level security;

revoke all on table public.erp_provider_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.erp_provider_settings to service_role;

create or replace function public.system_reset_tables(p_scope text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
  case p_scope
    when 'products' then return array['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories']::text[];
    when 'orders' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders']::text[];
    when 'commerce' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders']::text[];
    when 'documents' then return array['document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders']::text[];
    when 'media' then return array[]::text[];
    when 'content' then return array['site_pages', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings']::text[];
    when 'analytics' then return array['store_analytics_events', 'store_analytics_sessions', 'nps_responses']::text[];
    when 'full' then return array['erp_sync_jobs', 'erp_entity_links', 'erp_provider_settings', 'shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders', 'site_pages', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.system_reset_tables(text) from public, anon, authenticated;

commit;
