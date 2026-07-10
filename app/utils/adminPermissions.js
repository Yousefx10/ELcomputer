export const adminPermissionGroups = [
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
      { key: 'settings.edit', label: 'Can edit Settings?' }
    ]
  }
]

export const adminPermissionDefinitions = adminPermissionGroups.flatMap((group) => {
  return group.permissions
})

export const adminPermissionKeys = adminPermissionDefinitions.map((permission) => {
  return permission.key
})

export const defaultAdminPermissions = Object.fromEntries(
  adminPermissionKeys.map((permissionKey) => [permissionKey, false])
)

export const createEmptyAdminPermissions = () => {
  return { ...defaultAdminPermissions }
}

export const normalizeAdminPermissions = (permissions) => {
  const normalizedPermissions = createEmptyAdminPermissions()

  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return normalizedPermissions
  }

  adminPermissionKeys.forEach((permissionKey) => {
    normalizedPermissions[permissionKey] = Boolean(permissions[permissionKey])
  })

  return normalizedPermissions
}

export const countGrantedAdminPermissions = (permissions) => {
  return Object.values(normalizeAdminPermissions(permissions)).filter(Boolean).length
}

export const hasAdminPermission = (adminUser, permissionKey) => {
  if (!adminUser?.is_active) {
    return false
  }

  if (adminUser.role === 'owner') {
    return true
  }

  const normalizedPermissions = normalizeAdminPermissions(adminUser.permissions)
  return Boolean(normalizedPermissions[permissionKey])
}

const dashboardRouteRules = [
  {
    matches: (path) => path === '/dashboard/users',
    role: 'owner'
  },
  {
    matches: (path) => path === '/dashboard/settings',
    permission: 'settings.view'
  },
  {
    matches: (path) => path === '/dashboard/products/add',
    permission: 'products.add'
  },
  {
    matches: (path) => path.startsWith('/dashboard/products/edit/'),
    permission: 'products.edit'
  },
  {
    matches: (path) => path === '/dashboard/products/categories',
    permission: 'categories.view'
  },
  {
    matches: (path) => path === '/dashboard/products/brands',
    permission: 'brands.view'
  },
  {
    matches: (path) => path === '/dashboard/products',
    permission: 'products.view'
  }
]

export const getDashboardRouteRequirement = (path = '') => {
  return dashboardRouteRules.find((rule) => rule.matches(String(path))) || null
}
