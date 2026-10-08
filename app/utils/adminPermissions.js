import { normalizeDashboardQueryValue } from './dashboardNavigation.js'

export const adminPermissionGroups = [
  { key: 'email', title: 'Email', accessPermission: { key: 'email.view', label: 'Email Access' }, permissions: [
    { key: 'email.settings.view', label: 'View email settings' }, { key: 'email.settings.manage', label: 'Manage email settings' },
    { key: 'email.templates.view', label: 'View email templates' }, { key: 'email.templates.manage', label: 'Manage email templates' },
    { key: 'email.transactional.send', label: 'Send manual transactional email' }, { key: 'email.history.view', label: 'View email history and events' },
    { key: 'email.marketing.manage', label: 'Manage email consent and suppressions' }
  ] },
  {
    key: 'claims', title: 'After-Sales Claims',
    accessPermission: { key: 'claims.view', label: 'View after-sales claims' },
    permissions: [
      { key: 'claims.review', label: 'Review claims and request information' },
      { key: 'claims.manage', label: 'Manage manual receipt, inspection and cancellation' },
      { key: 'claims.evidence', label: 'View claim evidence' },
      { key: 'claims.notes', label: 'Add private claim notes' },
      { key: 'claims.decide', label: 'Approve or reject claims' },
      { key: 'claims.resolution', label: 'Record claim resolutions' },
      { key: 'claims.logistics.view', label: 'View claim reverse logistics' },
      { key: 'claims.logistics.create', label: 'Schedule claim reverse pickup' },
      { key: 'claims.logistics.retry', label: 'Recover or rebook claim shipments' },
      { key: 'claims.logistics.diagnostics', label: 'View reverse courier diagnostics' }
    ]
  },
  {
    key: 'sms', title: 'SMS',
    accessPermission: { key: 'sms.view', label: 'SMS Access' },
    permissions: [
      { key: 'sms.settings.view', label: 'View SMS settings' },
      { key: 'sms.settings.manage', label: 'Manage SMS settings' },
      { key: 'sms.templates.view', label: 'View SMS templates' },
      { key: 'sms.templates.manage', label: 'Manage SMS templates' },
      { key: 'sms.history.view', label: 'View SMS history' },
      { key: 'sms.notification.send', label: 'Send notification SMS' },
      { key: 'sms.campaign.send', label: 'Send campaign SMS' }
    ]
  },
  {
    key: 'dashboard',
    title: 'Dashboard',
    accessPermission: { key: 'dashboard.view', label: 'Dashboard Access' },
    permissions: [
      { key: 'dashboard.analysis', label: 'Analysis' },
      { key: 'dashboard.orders', label: 'Orders' }
    ]
  },
  {
    key: 'products',
    title: 'Products',
    accessPermission: { key: 'products.view', label: 'Products Access' },
    permissions: [
      { key: 'products.add', label: 'Add product' },
      { key: 'products.edit', label: 'Edit product' }
    ]
  },
  {
    key: 'categories',
    title: 'Categories',
    accessPermission: { key: 'categories.view', label: 'Categories Access' },
    permissions: [
      { key: 'categories.add', label: 'Add category' },
      { key: 'categories.edit', label: 'Edit category' }
    ]
  },
  {
    key: 'brands',
    title: 'Brands',
    accessPermission: { key: 'brands.view', label: 'Brands Access' },
    permissions: [
      { key: 'brands.add', label: 'Add brand' },
      { key: 'brands.edit', label: 'Edit brand' }
    ]
  },
  {
    key: 'settings',
    title: 'Settings',
    accessPermission: { key: 'settings.view', label: 'Settings Access' },
    permissions: [
      { key: 'settings.edit', label: 'Edit settings' },
      { key: 'settings.coupons', label: 'Access coupons' }
    ]
  },
  {
    key: 'users',
    title: 'Admin & Store Users',
    accessPermission: { key: 'users.view', label: 'Users Access' },
    permissions: []
  },
  {
    key: 'hr',
    title: 'HR',
    accessPermission: { key: 'hr.view', label: 'HR Access' },
    permissions: [
      { key: 'hr.edit', label: 'Add and edit employees' }
    ]
  },
  {
    key: 'treasury',
    title: 'Treasury',
    accessPermission: { key: 'treasury.view', label: 'Treasury Access' },
    permissions: [
      { key: 'treasury.edit', label: 'Record Treasury transactions' }
    ]
  },
  {
    key: 'documents',
    title: 'Documents',
    accessPermission: { key: 'documents.view', label: 'Documents Access' },
    permissions: [
      { key: 'documents.manage', label: 'Upload and manage documents' }
    ]
  },
  {
    key: 'pages',
    title: 'Pages',
    accessPermission: { key: 'pages.view', label: 'Pages Access' },
    permissions: [
      { key: 'pages.edit', label: 'Create and edit pages' }
    ]
  },
  {
    key: 'help',
    title: 'Help Center',
    accessPermission: { key: 'help.view', label: 'View help articles' },
    permissions: [{ key: 'help.edit', label: 'Manage help articles and categories' }]
  },
  {
    key: 'support',
    title: 'Customer Support',
    accessPermission: { key: 'support.view', label: 'View customer tickets' },
    permissions: [
      { key: 'support.reply', label: 'Reply and add internal notes' },
      { key: 'support.manage', label: 'Manage ticket status, priority and assignment' }
    ]
  }
]

export const adminPermissionDefinitions = adminPermissionGroups.flatMap((group) => {
  return [
    group.accessPermission,
    ...group.permissions
  ]
})

export const adminPermissionKeys = adminPermissionDefinitions.map((permission) => {
  return permission.key
})

export const adminPermissionDependencies = {
  'email.view': ['email.settings.view','email.settings.manage','email.templates.view','email.templates.manage','email.transactional.send','email.history.view','email.marketing.manage'],
  'email.settings.view': ['email.settings.manage'], 'email.templates.view': ['email.templates.manage'],
  'sms.view': ['sms.settings.view', 'sms.settings.manage', 'sms.templates.view', 'sms.templates.manage', 'sms.history.view', 'sms.notification.send', 'sms.campaign.send'],
  'sms.settings.view': ['sms.settings.manage'],
  'sms.templates.view': ['sms.templates.manage'],
  'dashboard.view': ['dashboard.analysis', 'dashboard.orders'],
  'products.view': ['products.add', 'products.edit'],
  'categories.view': ['categories.add', 'categories.edit'],
  'brands.view': ['brands.add', 'brands.edit'],
  'settings.view': ['settings.edit', 'settings.coupons'],
  'hr.view': ['hr.edit'],
  'treasury.view': ['treasury.edit'],
  'documents.view': ['documents.manage'],
  'pages.view': ['pages.edit'],
  'help.view': ['help.edit'],
  'support.view': ['support.reply', 'support.manage'],
  'claims.view': ['claims.review', 'claims.manage', 'claims.evidence', 'claims.notes', 'claims.decide', 'claims.resolution', 'claims.logistics.view', 'claims.logistics.create', 'claims.logistics.retry', 'claims.logistics.diagnostics'],
  'claims.logistics.view': ['claims.logistics.create', 'claims.logistics.retry', 'claims.logistics.diagnostics']
}

export const defaultAdminPermissions = Object.fromEntries(
  adminPermissionKeys.map((permissionKey) => [permissionKey, false])
)

export const createEmptyAdminPermissions = () => {
  return { ...defaultAdminPermissions }
}

export const createFullAdminPermissions = () => {
  return Object.fromEntries(
    adminPermissionKeys.map((permissionKey) => [permissionKey, true])
  )
}

export const normalizeAdminPermissions = (permissions, role = 'admin') => {
  if (role === 'owner') {
    return createFullAdminPermissions()
  }

  const normalizedPermissions = createEmptyAdminPermissions()

  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return normalizedPermissions
  }

  adminPermissionKeys.forEach((permissionKey) => {
    normalizedPermissions[permissionKey] = Boolean(permissions[permissionKey])
  })

  Object.entries(adminPermissionDependencies).forEach(([parentPermissionKey, dependentPermissionKeys]) => {
    if (normalizedPermissions[parentPermissionKey]) {
      return
    }

    dependentPermissionKeys.forEach((dependentPermissionKey) => {
      normalizedPermissions[dependentPermissionKey] = false
    })
  })

  return normalizedPermissions
}

export const countGrantedAdminPermissions = (permissions, role = 'admin') => {
  return Object.values(normalizeAdminPermissions(permissions, role)).filter(Boolean).length
}

export const hasAdminPermission = (adminUser, permissionKey) => {
  if (!adminUser?.is_active) {
    return false
  }

  if (adminUser.role === 'owner') {
    return true
  }

  const normalizedPermissions = normalizeAdminPermissions(adminUser.permissions, adminUser.role)
  return Boolean(normalizedPermissions[permissionKey])
}

export const getDashboardRouteRequirement = (route = '') => {
  const path = typeof route === 'string' ? route : String(route?.path || '')
  const query = typeof route === 'string' ? {} : route?.query || {}
  const tab = normalizeDashboardQueryValue(query.tab)
  const view = normalizeDashboardQueryValue(query.view)

  if (path === '/dashboard/after-sales' || path.startsWith('/dashboard/after-sales/')) return { permission: 'claims.view' }

  if (path === '/dashboard/email') return { permission: ({ settings:'email.settings.view', templates:'email.templates.view', send:'email.transactional.send', history:'email.history.view', events:'email.history.view', preferences:'email.marketing.manage' })[tab || 'settings'] || 'email.view' }

  if (path === '/dashboard/sms') {
    const permissions = { settings: 'sms.settings.view', templates: 'sms.templates.view', history: 'sms.history.view' }
    if (tab === 'send') return { permissionsAny: ['sms.notification.send', 'sms.campaign.send'] }
    return { permission: permissions[tab || 'settings'] || 'sms.view' }
  }

  if (path === '/dashboard/users') {
    return {
      permission: 'users.view'
    }
  }

  if (path === '/dashboard/hr') {
    if (tab === 'users') {
      return {
        permission: 'users.view'
      }
    }

    return {
      permissionsAny: ['hr.view', 'users.view']
    }
  }

  if (path === '/dashboard/treasury') {
    return {
      permission: 'treasury.view'
    }
  }

  if (path === '/dashboard/erp') {
    return {
      permission: 'dashboard.analysis'
    }
  }

  if (path === '/dashboard/documents') {
    return {
      permission: 'documents.view'
    }
  }

  if (path === '/dashboard/pages') {
    return {
      permission: 'pages.view'
    }
  }

  if (path === '/dashboard/help') return { permission: 'help.view' }
  if (path === '/dashboard/support' || path.startsWith('/dashboard/support/')) {
    return { permission: 'support.view' }
  }
  if (path === '/dashboard/live-chat' || path.startsWith('/dashboard/live-chat/')) {
    return { permission: 'support.view' }
  }

  if (path === '/dashboard/orders' || path.startsWith('/dashboard/orders/')) {
    return {
      permission: 'dashboard.orders'
    }
  }

  if (path === '/dashboard/settings') {
    if (tab === 'reset') return { role: 'owner' }

    if (tab === 'users') {
      return {
        permission: 'users.view'
      }
    }

    if (tab === 'logs') {
      return {
        permission: 'settings.view'
      }
    }

    if (tab === 'gallery') {
      return {
        permission: 'settings.view'
      }
    }

    if (tab === 'coupons') {
      return {
        permission: 'settings.coupons'
      }
    }

    if (tab) {
      return { permission: 'settings.view' }
    }

    return {
      permissionsAny: ['settings.view', 'settings.coupons']
    }
  }

  if (path === '/dashboard/products/add') {
    return {
      permission: 'products.add'
    }
  }

  if (path.startsWith('/dashboard/products/edit/')) {
    return {
      permission: 'products.edit'
    }
  }

  if (path === '/dashboard/products/categories') {
    return {
      permission: 'categories.view'
    }
  }

  if (path === '/dashboard/catalog') {
    if (tab === 'reviews') {
      return null
    }

    if (tab === 'brands') {
      return {
        permission: 'brands.view'
      }
    }

    return null
  }

  if (path === '/dashboard/products/brands') {
    return {
      permission: 'brands.view'
    }
  }

  if (path === '/dashboard/products') {
    return {
      permission: 'products.view'
    }
  }

  if (path === '/dashboard' && view === 'orders') {
    return { permission: 'dashboard.orders' }
  }

  if (path === '/dashboard' && view === 'stock') {
    return { permissionsAny: ['products.view', 'categories.view'] }
  }

  if (path === '/dashboard' && ['analysis', 'customers'].includes(view)) {
    return {
      permission: 'dashboard.analysis'
    }
  }

  return null
}
