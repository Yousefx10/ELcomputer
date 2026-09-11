import { dashboardSettingsSections } from './dashboardSettings.js'

export const normalizeDashboardQueryValue = (value) => {
  const selectedValue = Array.isArray(value) ? value[0] : value

  return String(selectedValue || '').trim().toLowerCase()
}

export const getDashboardQueryValue = (route, key) => {
  return normalizeDashboardQueryValue(route?.query?.[key])
}

const matchesPath = (route, match = {}) => {
  const routePath = String(route?.path || '')
  const paths = match.paths || []
  const prefixes = match.prefixes || []

  return paths.includes(routePath) || prefixes.some((prefix) => {
    return routePath.startsWith(prefix)
  })
}

export const matchesDashboardNavigation = (route, match = {}) => {
  if (!matchesPath(route, match)) {
    return false
  }

  if (match.query) {
    return Object.entries(match.query).every(([key, values]) => values.includes(getDashboardQueryValue(route, key)))
  }

  if (!match.queryKey) {
    return true
  }

  return (match.queryValues || ['']).includes(
    getDashboardQueryValue(route, match.queryKey)
  )
}

const child = (key, label, icon, path, queryKey, values, permission) => ({
  key, label, icon: `lucide:${icon}`, permission,
  to: path + (queryKey && values[0] ? `?${queryKey}=${values[0]}` : ''),
  documentTitle: `Dashboard - ${label}`,
  match: { paths: [path], ...(queryKey ? { queryKey, queryValues: values } : {}) }
})
const group = (key, label, icon, match, children, access = {}) => ({
  key, label, icon: `lucide:${icon}`, match, children, to: children[0]?.to, ...access
})

export const dashboardNavigationGroups = [
  group('dashboard', 'Dashboard', 'layout-dashboard', { paths: ['/dashboard'] }, [
    child('summary', 'Summary', 'gauge', '/dashboard', 'view', ['', 'summary']),
    child('order-summary', 'Order summary', 'shopping-bag', '/dashboard', 'view', ['orders'], 'dashboard.orders'),
    { ...child('stock-summary', 'Stock overview', 'boxes', '/dashboard', 'view', ['stock']), permissionsAny: ['products.view', 'categories.view'] },
    child('analysis', 'Sales analysis', 'chart-no-axes-combined', '/dashboard', 'view', ['analysis'], 'dashboard.analysis'),
    child('customer-experience', 'Customer feedback', 'message-square-heart', '/dashboard', 'view', ['customers'], 'dashboard.analysis')
  ]),
  group('orders', 'Orders', 'shopping-bag', { paths: ['/dashboard/orders'], prefixes: ['/dashboard/orders/'] }, [
    child('orders', 'All orders', 'list', '/dashboard/orders', 'view', ['', 'all'], 'dashboard.orders'),
    child('recent-orders', 'Recent orders', 'clock', '/dashboard/orders', 'view', ['recent'], 'dashboard.orders'),
    child('confirm-orders', 'Confirm & pack', 'scan-barcode', '/dashboard/orders/confirm', null, [], 'dashboard.orders')
  ], { permission: 'dashboard.orders' }),
  group('products', 'Products', 'package', { paths: ['/dashboard/products', '/dashboard/products/add'], prefixes: ['/dashboard/products/edit/'] }, [
    { ...child('all-products', 'All products', 'boxes', '/dashboard/products', 'status', ['', 'all'], 'products.view'), match: { paths: ['/dashboard/products'], prefixes: ['/dashboard/products/edit/'], queryKey: 'status', queryValues: ['', 'all'] } },
    child('published-products', 'Published', 'eye', '/dashboard/products', 'status', ['published'], 'products.view'),
    child('draft-products', 'Drafts', 'file-pen-line', '/dashboard/products', 'status', ['drafts'], 'products.view'),
    child('add-product', 'Add product', 'circle-plus', '/dashboard/products/add', null, [], 'products.add')
  ], { permission: 'products.view' }),
  group('catalog', 'Catalog', 'library-big', { paths: ['/dashboard/catalog'] }, [
    child('categories', 'Categories', 'tags', '/dashboard/catalog', 'tab', ['', 'categories'], 'categories.view'),
    child('brands', 'Brands', 'badge', '/dashboard/catalog', 'tab', ['brands'], 'brands.view'),
    child('reviews', 'Product reviews', 'messages-square', '/dashboard/catalog', 'tab', ['reviews'])
  ]),
  group('crm', 'CRM', 'contact-round', { paths: ['/dashboard/crm'] }, [
    child('contacts', 'Contacts', 'contact', '/dashboard/crm', 'tab', ['', 'contacts']),
    { ...child('tickets', 'Tickets', 'ticket', '/dashboard/crm', 'tab', ['activities']), match: { paths: ['/dashboard/crm'], query: { tab: ['activities'], panel: ['', 'tickets'] } } },
    { ...child('activity-history', 'Calls & history', 'history', '/dashboard/crm', 'tab', ['activities']), to: '/dashboard/crm?tab=activities&panel=history', match: { paths: ['/dashboard/crm'], query: { tab: ['activities'], panel: ['history'] } } }
  ]),
  group('commerce', 'Purchases & sales', 'briefcase-business', { paths: ['/dashboard/commerce'], queryKey: 'tab', queryValues: ['', 'procurement', 'sales', 'returns'] }, [
    child('procurement', 'Purchase invoices', 'shopping-basket', '/dashboard/commerce', 'tab', ['', 'procurement']),
    child('sales', 'Sales invoices', 'badge-dollar-sign', '/dashboard/commerce', 'tab', ['sales']),
    child('returns', 'Returns', 'rotate-ccw', '/dashboard/commerce', 'tab', ['returns'])
  ]),
  group('inventory', 'Inventory', 'warehouse', { paths: ['/dashboard/commerce'], queryKey: 'tab', queryValues: ['warehouses', 'serialized', 'scan'] }, [
    child('warehouses', 'Warehouses', 'warehouse', '/dashboard/commerce', 'tab', ['warehouses']),
    child('serialized', 'Serialized items', 'package-search', '/dashboard/commerce', 'tab', ['serialized']),
    child('scan', 'Scan item', 'scan-line', '/dashboard/commerce', 'tab', ['scan'])
  ]),
  group('shipping', 'Shipping', 'truck', { paths: ['/dashboard/commerce'], queryKey: 'tab', queryValues: ['shipping'] }, [
    child('shipping', 'Shipping companies', 'truck', '/dashboard/commerce', 'tab', ['shipping'])
  ]),
  group('hr', 'People', 'users-round', { paths: ['/dashboard/hr', '/dashboard/users'] }, [
    child('employees', 'Employees', 'user-round', '/dashboard/hr', 'tab', ['', 'employees'], 'hr.view'),
    { ...child('users', 'Admin users', 'shield-user', '/dashboard/hr', 'tab', ['users'], 'users.view'), match: { paths: ['/dashboard/hr'], query: { tab: ['users'], people: ['', 'admins'] } } },
    { ...child('customers', 'Store customers', 'users', '/dashboard/hr', 'tab', ['users'], 'users.view'), to: '/dashboard/hr?tab=users&people=customers', match: { paths: ['/dashboard/hr'], query: { tab: ['users'], people: ['customers'] } } }
  ], { permissionsAny: ['hr.view', 'users.view'] }),
  group('treasury', 'Treasury', 'landmark', { paths: ['/dashboard/treasury'] }, [
    child('transactions', 'Transactions', 'history', '/dashboard/treasury', 'action', ['', 'transactions'], 'treasury.view'),
    child('supplier-payment', 'Supplier payments', 'receipt-text', '/dashboard/treasury', 'action', ['supplier_payment'], 'treasury.view'),
    child('customer-receipt', 'Customer receipts', 'hand-coins', '/dashboard/treasury', 'action', ['customer_receipt'], 'treasury.view'),
    child('salary-payment', 'Salary payments', 'badge-dollar-sign', '/dashboard/treasury', 'action', ['salary_payment'], 'treasury.view')
  ], { permission: 'treasury.view' }),
  { key: 'documents', label: 'Documents', icon: 'lucide:folder-closed', to: '/dashboard/documents', permission: 'documents.view', documentTitle: 'Dashboard - Documents', match: { paths: ['/dashboard/documents'] } },
  group('settings', 'Settings', 'settings', { paths: ['/dashboard/settings'] }, [
    child('settings-overview', 'All settings', 'sliders-horizontal', '/dashboard/settings', 'tab', [''], 'settings.view'),
    ...dashboardSettingsSections.map(item => ({
      ...item, documentTitle: `Dashboard - Settings - ${item.label}`,
      match: { paths: ['/dashboard/settings'], queryKey: 'tab', queryValues: [item.key] }
    }))
  ], { permissionsAny: ['settings.view', 'settings.coupons'] })
]

const canAccessNavigationItem = (item, access = {}) => {
  if (item.role === 'owner' && !access.isOwner) return false

  if (item.permissionsAny?.length) {
    return access.hasAnyPermission(item.permissionsAny)
  }

  if (item.permission) {
    return access.hasPermission(item.permission)
  }

  return true
}

export const buildDashboardNavigation = (access = {}) => {
  const safeAccess = {
    isOwner: access.isOwner === true,
    hasAnyPermission: access.hasAnyPermission || (() => true),
    hasPermission: access.hasPermission || (() => true)
  }

  return dashboardNavigationGroups.reduce((groups, group) => {
    if (!canAccessNavigationItem(group, safeAccess)) {
      return groups
    }

    const children = (group.children || []).filter((item) => {
      return canAccessNavigationItem(item, safeAccess)
    })

    if (group.children?.length && !children.length) {
      return groups
    }

    groups.push({
      ...group,
      to: children[0]?.to || group.to,
      children
    })

    return groups
  }, [])
}
