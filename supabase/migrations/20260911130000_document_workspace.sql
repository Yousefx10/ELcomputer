begin;

create table if not exists public.document_quick_access (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  folder_id uuid references public.document_folders (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint document_quick_access_one_item_check
    check (num_nonnulls(folder_id, document_id) = 1)
);

create unique index if not exists document_quick_access_folder_uidx
on public.document_quick_access (admin_user_id, folder_id)
where folder_id is not null;

create unique index if not exists document_quick_access_document_uidx
on public.document_quick_access (admin_user_id, document_id)
where document_id is not null;

create index if not exists document_quick_access_user_created_idx
on public.document_quick_access (admin_user_id, created_at desc);

create table if not exists public.document_recent_items (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  last_opened_at timestamptz not null default now()
);

create unique index if not exists document_recent_items_user_document_uidx
on public.document_recent_items (admin_user_id, document_id);

create index if not exists document_recent_items_user_opened_idx
on public.document_recent_items (admin_user_id, last_opened_at desc);

alter table public.document_quick_access enable row level security;
alter table public.document_recent_items enable row level security;

revoke all on table public.document_quick_access from public, anon, authenticated;
revoke all on table public.document_recent_items from public, anon, authenticated;
grant select, insert, update, delete on table public.document_quick_access to service_role;
grant select, insert, update, delete on table public.document_recent_items to service_role;

create or replace function public.system_reset_tables(p_scope text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
  case p_scope
    when 'products' then return array['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories']::text[];
    when 'orders' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders']::text[];
    when 'commerce' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders']::text[];
    when 'documents' then return array['document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders']::text[];
    when 'media' then return array[]::text[];
    when 'content' then return array['site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings']::text[];
    when 'analytics' then return array['store_analytics_events', 'store_analytics_sessions', 'nps_responses']::text[];
    when 'full' then return array['erp_sync_jobs', 'erp_entity_links', 'shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.system_reset_tables(text) from public, anon, authenticated;

commit;
