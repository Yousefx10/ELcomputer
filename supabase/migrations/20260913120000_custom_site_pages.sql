begin;

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  path text not null unique,
  content_markdown text not null default '',
  is_published boolean not null default false,
  show_in_navbar boolean not null default false,
  created_by uuid references public.admin_users (id) on delete set null,
  updated_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_pages_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint site_pages_path_check check (
    char_length(path) between 1 and 160
    and path = lower(path)
    and path ~ '^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$'
  ),
  constraint site_pages_content_size_check check (char_length(content_markdown) <= 100000)
);

create index if not exists site_pages_public_nav_idx
on public.site_pages (is_published, show_in_navbar, created_at);

create index if not exists site_pages_updated_idx
on public.site_pages (updated_at desc);

alter table public.site_pages enable row level security;

drop policy if exists "Public can read published site pages" on public.site_pages;
create policy "Public can read published site pages"
on public.site_pages for select to public
using (is_published = true);

revoke all on table public.site_pages from public, anon, authenticated;
grant select on table public.site_pages to anon, authenticated;
grant select, insert, update, delete on table public.site_pages to service_role;

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
    when 'full' then return array['erp_sync_jobs', 'erp_entity_links', 'shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders', 'site_pages', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.system_reset_tables(text) from public, anon, authenticated;

commit;
