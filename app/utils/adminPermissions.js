export const adminPermissionGroups = [
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
  'dashboard.view': ['dashboard.analysis', 'dashboard.orders'],
  'products.view': ['products.add', 'products.edit'],
  'categories.view': ['categories.add', 'categories.edit'],
  'brands.view': ['brands.add', 'brands.edit'],
  'settings.view': ['settings.edit', 'settings.coupons'],
  'hr.view': ['hr.edit'],
  'treasury.view': ['treasury.edit']
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

  if (path === '/dashboard/users') {
    return {
      permission: 'users.view'
    }
  }

  if (path === '/dashboard/hr') {
    if (query.tab === 'users') {
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

  if (path === '/dashboard/orders') {
    return {
      permission: 'dashboard.orders'
    }
  }

  if (path === '/dashboard/settings') {
    if (query.tab === 'users') {
      return {
        permission: 'users.view'
      }
    }

    if (query.tab === 'logs') {
      return {
        permission: 'settings.view'
      }
    }

    if (query.tab === 'gallery') {
      return {
        permission: 'settings.view'
      }
    }

    if (query.tab === 'coupons') {
      return {
        permission: 'settings.coupons'
      }
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
    if (query.tab === 'brands') {
      return {
        permission: 'brands.view'
      }
    }

    return {
      permissionsAny: ['categories.view', 'brands.view']
    }
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

  if (path === '/dashboard' && query.view === 'analysis') {
    return {
      permission: 'dashboard.analysis'
    }
  }

  return null
}
