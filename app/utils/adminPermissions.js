export const adminPermissionGroups = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    permissions: [
      { key: 'dashboard.analysis', label: 'Can See Analysis?' },
      { key: 'dashboard.orders', label: 'Can See Orders?' }
    ]
  },
  {
    key: 'products',
    title: 'Products',
    permissions: [
      { key: 'products.view', label: 'Can view products?' },
      { key: 'products.add', label: 'Can Add product?' },
      { key: 'products.edit', label: 'Can edit product?' }
    ]
  },
  {
    key: 'categories',
    title: 'Categories',
    permissions: [
      { key: 'categories.view', label: 'Can view category?' },
      { key: 'categories.add', label: 'Can Add category?' },
      { key: 'categories.edit', label: 'Can edit category?' }
    ]
  },
  {
    key: 'brands',
    title: 'Brands',
    permissions: [
      { key: 'brands.view', label: 'Can view Brands?' },
      { key: 'brands.add', label: 'Can Add Brands?' },
      { key: 'brands.edit', label: 'Can edit Brands?' }
    ]
  },
  {
    key: 'settings',
    title: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'Can view Settings?' },
      { key: 'settings.edit', label: 'Can edit Settings?' },
      { key: 'settings.coupons', label: 'Can Access Coupons?' },
      { key: 'settings.inventory', label: 'Can Access Inventory?' }
    ]
  },
  {
    key: 'users',
    title: 'Users',
    permissions: [
      { key: 'users.view', label: 'Can Access Users page?' }
    ]
  }
]

export const adminPermissionDefinitions = adminPermissionGroups.flatMap((group) => {
  return group.permissions
})

export const adminPermissionKeys = adminPermissionDefinitions.map((permission) => {
  return permission.key
})

export const adminPermissionDependencies = {
  'products.view': ['products.add', 'products.edit'],
  'categories.view': ['categories.add', 'categories.edit'],
  'brands.view': ['brands.add', 'brands.edit'],
  'settings.view': ['settings.edit']
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

  if (path === '/dashboard/orders') {
    return {
      permission: 'dashboard.orders'
    }
  }

  if (path === '/dashboard/settings') {
    if (query.tab === 'coupons') {
      return {
        permission: 'settings.coupons'
      }
    }

    if (query.tab === 'inventory') {
      return {
        permission: 'settings.inventory'
      }
    }

    return {
      permissionsAny: ['settings.view', 'settings.coupons', 'settings.inventory']
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
