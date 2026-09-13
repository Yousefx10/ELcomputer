begin;

create table if not exists public.document_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'blue'
    check (color in ('blue', 'violet', 'emerald', 'amber', 'rose', 'slate')),
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_tags_name_check check (char_length(btrim(name)) between 1 and 32)
);

create unique index if not exists document_tags_name_uidx
on public.document_tags (lower(btrim(name)));

create table if not exists public.document_file_tags (
  document_id uuid not null references public.documents (id) on delete cascade,
  tag_id uuid not null references public.document_tags (id) on delete cascade,
  added_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id)
);

create table if not exists public.document_folder_tags (
  folder_id uuid not null references public.document_folders (id) on delete cascade,
  tag_id uuid not null references public.document_tags (id) on delete cascade,
  added_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (folder_id, tag_id)
);

create index if not exists document_file_tags_tag_idx
on public.document_file_tags (tag_id, document_id);

create index if not exists document_folder_tags_tag_idx
on public.document_folder_tags (tag_id, folder_id);

alter table public.document_tags enable row level security;
alter table public.document_file_tags enable row level security;
alter table public.document_folder_tags enable row level security;

revoke all on table public.document_tags from public, anon, authenticated;
revoke all on table public.document_file_tags from public, anon, authenticated;
revoke all on table public.document_folder_tags from public, anon, authenticated;
grant select, insert, update, delete on table public.document_tags to service_role;
grant select, insert, update, delete on table public.document_file_tags to service_role;
grant select, insert, update, delete on table public.document_folder_tags to service_role;

create or replace function public.document_set_item_tags(
  p_item_type text,
  p_item_id uuid,
  p_tag_ids uuid[],
  p_admin_user_id uuid
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_item_type = 'file' then
    delete from public.document_file_tags where document_id = p_item_id;
    insert into public.document_file_tags (document_id, tag_id, added_by)
    select p_item_id, tag_id, p_admin_user_id from unnest(p_tag_ids) as tag_id;
  elsif p_item_type = 'folder' then
    delete from public.document_folder_tags where folder_id = p_item_id;
    insert into public.document_folder_tags (folder_id, tag_id, added_by)
    select p_item_id, tag_id, p_admin_user_id from unnest(p_tag_ids) as tag_id;
  else
    raise exception 'Unsupported document item type.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.document_set_item_tags(text, uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.document_set_item_tags(text, uuid, uuid[], uuid) to service_role;

create or replace function public.system_reset_tables(p_scope text)
returns text[] language plpgsql immutable set search_path = '' as $$
begin
  case p_scope
    when 'products' then return array['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories']::text[];
    when 'orders' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders']::text[];
    when 'commerce' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders']::text[];
    when 'documents' then return array['document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders']::text[];
    when 'media' then return array[]::text[];
    when 'content' then return array['site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings']::text[];
    when 'analytics' then return array['store_analytics_events', 'store_analytics_sessions', 'nps_responses']::text[];
    when 'full' then return array['erp_sync_jobs', 'erp_entity_links', 'shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.system_reset_tables(text) from public, anon, authenticated;

commit;
