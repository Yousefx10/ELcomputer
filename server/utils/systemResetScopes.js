// Explicit scope lists prevent an unrelated table from being erased implicitly.
export const resetTableGroups = {
  erp: ['erp_sync_jobs', 'erp_entity_links'],
  orders: ['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders'],
  inventory: ['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory'],
  trading: ['treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders'],
  catalog: ['product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories'],
  documents: ['document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders'],
  content: ['site_pages', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings'],
  analytics: ['store_analytics_events', 'store_analytics_sessions', 'nps_responses'],
  other: ['commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']
}

export const systemResetScopes = [
  { key: 'products', label: 'Products reset', icon: 'lucide:package', description: 'Erase the catalog and its inventory records.', details: ['Products, variants, images, specifications, reviews, brands and categories.', 'Stock records, serialized units and inventory movement history.', 'Existing order snapshots stay. Linked commerce may block this reset.'], tables: [...resetTableGroups.inventory, ...resetTableGroups.catalog] },
  { key: 'orders', label: 'Orders reset', icon: 'lucide:shopping-bag', description: 'Erase online orders and their related records.', details: ['Online orders, items, returns, packing and customer order messages.', 'Shipping jobs and webhook history. Stock quantities stay unchanged.', 'Linked serialized inventory may require a commerce reset first.'], tables: resetTableGroups.orders },
  { key: 'commerce', label: 'Commerce reset', icon: 'lucide:warehouse', description: 'Erase transactions and start inventory from zero.', details: ['Online orders, manual sales, purchasing, returns and packing.', 'All stock records, transfers, serialized units and treasury transactions.', 'Products, customers, warehouses and employees remain. Stock becomes zero.'], tables: [...resetTableGroups.orders, ...resetTableGroups.inventory, ...resetTableGroups.trading] },
  { key: 'documents', label: 'Documents reset', icon: 'lucide:folder', description: 'Erase all documents, folders and folder permissions.', details: ['All document files, folders and access assignments.', 'The document storage bucket remains ready for new uploads.'], tables: resetTableGroups.documents, documentFiles: true },
  { key: 'media', label: 'Media library reset', icon: 'lucide:images', description: 'Erase uploaded images and clear their references.', details: ['All images uploaded through this website.', 'Uploaded image references are cleared from products and store content.', 'Products, orders and externally hosted images remain.'], tables: [], mediaFiles: true },
  { key: 'content', label: 'Store content reset', icon: 'lucide:panels-top-left', description: 'Restore store content and layout to their defaults.', details: ['Custom pages, store settings, banners, announcements, offers and navigation links.', 'Products, orders, coupons, uploaded files and shipping configuration remain.'], tables: resetTableGroups.content },
  { key: 'analytics', label: 'Analytics reset', icon: 'lucide:chart-no-axes-combined', description: 'Erase visitor activity and customer feedback history.', details: ['Visitor sessions, events and NPS responses.', 'Orders, product reviews and internal-user exclusions remain.'], tables: resetTableGroups.analytics },
  { key: 'full', label: 'Full system reset', icon: 'lucide:rotate-ccw', description: 'Erase website data and start again.', details: ['All store data, customers, other admins, documents and uploaded media.', 'Your current owner login and the installed application remain.', 'A new completion log records who performed the reset.'], tables: [...new Set(Object.values(resetTableGroups).flat())], mediaFiles: true, documentFiles: true, authUsers: true }
]

export const getSystemResetScope = (key) => systemResetScopes.find((scope) => scope.key === key)
export const getResetConfirmation = (key) => `RESET ${key.toUpperCase()}`
export const publicResetScope = ({ key, label, icon, description, details }) => ({ key, label, icon, description, details, confirmation: getResetConfirmation(key) })
