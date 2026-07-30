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

  if (!match.queryKey) {
    return true
  }

  return (match.queryValues || ['']).includes(
    getDashboardQueryValue(route, match.queryKey)
  )
}

export const dashboardNavigationGroups = [
  {
    key: 'dashboard',
    label: 'Home',
    detailedLabel: 'Dashboard',
    icon: 'lucide:layout-dashboard',
    to: '/dashboard',
    match: {
      paths: ['/dashboard', '/dashboard/orders'],
      prefixes: ['/dashboard/orders/']
    },
    children: [
      {
        key: 'summary',
        label: 'Summary',
        icon: 'lucide:gauge',
        to: '/dashboard',
        documentTitle: 'Dashboard',
        match: {
          paths: ['/dashboard'],
          queryKey: 'view',
          queryValues: ['']
        }
      },
      {
        key: 'analysis',
        label: 'Analysis',
        icon: 'lucide:chart-no-axes-combined',
        to: '/dashboard?view=analysis',
        permission: 'dashboard.analysis',
        documentTitle: 'Dashboard - Analysis',
        match: {
          paths: ['/dashboard'],
          queryKey: 'view',
          queryValues: ['analysis']
        }
      },
      {
        key: 'orders',
        label: 'Orders',
        icon: 'lucide:shopping-bag',
        to: '/dashboard/orders',
        permission: 'dashboard.orders',
        documentTitle: 'Dashboard - Orders',
        match: {
          paths: ['/dashboard/orders'],
          prefixes: ['/dashboard/orders/']
        }
      }
    ]
  },
  {
    key: 'products',
    label: 'Products',
    icon: 'lucide:package',
    to: '/dashboard/products',
    permission: 'products.view',
    match: {
      paths: ['/dashboard/products', '/dashboard/products/add'],
      prefixes: ['/dashboard/products/edit/']
    },
    children: [
      {
        key: 'all-products',
        label: 'All Products',
        icon: 'lucide:boxes',
        to: '/dashboard/products',
        permission: 'products.view',
        documentTitle: 'Dashboard - Products',
        match: {
          paths: ['/dashboard/products'],
          prefixes: ['/dashboard/products/edit/']
        }
      },
      {
        key: 'add-product',
        label: 'Add Product',
        icon: 'lucide:circle-plus',
        to: '/dashboard/products/add',
        permission: 'products.add',
        documentTitle: 'Dashboard - Add Product',
        match: {
          paths: ['/dashboard/products/add']
        }
      }
    ]
  },
  {
    key: 'catalog',
    label: 'Catalog',
    icon: 'lucide:library-big',
    to: '/dashboard/catalog',
    match: {
      paths: ['/dashboard/catalog']
    },
    children: [
      {
        key: 'categories',
        label: 'Categories',
        icon: 'lucide:tags',
        to: '/dashboard/catalog',
        permission: 'categories.view',
        documentTitle: 'Dashboard - Catalog - Categories',
        match: {
          paths: ['/dashboard/catalog'],
          queryKey: 'tab',
          queryValues: ['', 'categories']
        }
      },
      {
        key: 'brands',
        label: 'Brands',
        icon: 'lucide:badge',
        to: '/dashboard/catalog?tab=brands',
        permission: 'brands.view',
        documentTitle: 'Dashboard - Catalog - Brands',
        match: {
          paths: ['/dashboard/catalog'],
          queryKey: 'tab',
          queryValues: ['brands']
        }
      },
      {
        key: 'reviews',
        label: 'Reviews',
        icon: 'lucide:messages-square',
        to: '/dashboard/catalog?tab=reviews',
        documentTitle: 'Dashboard - Catalog - Reviews',
        match: {
          paths: ['/dashboard/catalog'],
          queryKey: 'tab',
          queryValues: ['reviews']
        }
      }
    ]
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: 'lucide:contact-round',
    to: '/dashboard/crm',
    match: {
      paths: ['/dashboard/crm']
    },
    children: [
      {
        key: 'contacts',
        label: 'Contacts',
        icon: 'lucide:contact',
        to: '/dashboard/crm',
        documentTitle: 'Dashboard - CRM - Contacts',
        match: {
          paths: ['/dashboard/crm'],
          queryKey: 'tab',
          queryValues: ['', 'contacts']
        }
      },
      {
        key: 'activities',
        label: 'Tickets & Activity',
        icon: 'lucide:ticket',
        to: '/dashboard/crm?tab=activities',
        documentTitle: 'Dashboard - CRM - Tickets & Activity',
        match: {
          paths: ['/dashboard/crm'],
          queryKey: 'tab',
          queryValues: ['activities']
        }
      }
    ]
  },
  {
    key: 'commerce',
    label: 'Commerce',
    icon: 'lucide:briefcase-business',
    to: '/dashboard/commerce',
    match: {
      paths: ['/dashboard/commerce']
    },
    children: [
      {
        key: 'procurement',
        label: 'Procurement',
        icon: 'lucide:shopping-basket',
        to: '/dashboard/commerce',
        documentTitle: 'Dashboard - Commerce - Procurement',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['', 'procurement']
        }
      },
      {
        key: 'sales',
        label: 'Sales',
        icon: 'lucide:badge-dollar-sign',
        to: '/dashboard/commerce?tab=sales',
        documentTitle: 'Dashboard - Commerce - Sales',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['sales']
        }
      },
      {
        key: 'shipping',
        label: 'Shipping',
        icon: 'lucide:truck',
        to: '/dashboard/commerce?tab=shipping',
        documentTitle: 'Dashboard - Commerce - Shipping',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['shipping']
        }
      },
      {
        key: 'warehouses',
        label: 'Warehouses',
        icon: 'lucide:warehouse',
        to: '/dashboard/commerce?tab=warehouses',
        documentTitle: 'Dashboard - Commerce - Warehouses',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['warehouses']
        }
      },
      {
        key: 'serialized',
        label: 'Serialized Items',
        icon: 'lucide:package-search',
        to: '/dashboard/commerce?tab=serialized',
        documentTitle: 'Dashboard - Commerce - Serialized Items',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['serialized']
        }
      },
      {
        key: 'scan',
        label: 'Scan Item',
        icon: 'lucide:scan-line',
        to: '/dashboard/commerce?tab=scan',
        documentTitle: 'Dashboard - Commerce - Scan Item',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['scan']
        }
      },
      {
        key: 'returns',
        label: 'Returns',
        icon: 'lucide:rotate-ccw',
        to: '/dashboard/commerce?tab=returns',
        documentTitle: 'Dashboard - Commerce - Returns',
        match: {
          paths: ['/dashboard/commerce'],
          queryKey: 'tab',
          queryValues: ['returns']
        }
      }
    ]
  },
  {
    key: 'hr',
    label: 'HR',
    icon: 'lucide:users-round',
    to: '/dashboard/hr',
    permissionsAny: ['hr.view', 'users.view'],
    match: {
      paths: ['/dashboard/hr', '/dashboard/users']
    },
    children: [
      {
        key: 'employees',
        label: 'Employees',
        icon: 'lucide:user-round',
        to: '/dashboard/hr',
        permission: 'hr.view',
        documentTitle: 'Dashboard - HR - Employees',
        match: {
          paths: ['/dashboard/hr'],
          queryKey: 'tab',
          queryValues: ['', 'employees']
        }
      },
      {
        key: 'users',
        label: 'Users',
        detailedLabel: 'Admin & Store Users',
        icon: 'lucide:users',
        to: '/dashboard/hr?tab=users',
        permission: 'users.view',
        documentTitle: 'Dashboard - HR - Users',
        match: {
          paths: ['/dashboard/hr', '/dashboard/users'],
          queryKey: 'tab',
          queryValues: ['users', '']
        }
      }
    ]
  },
  {
    key: 'treasury',
    label: 'Treasury',
    icon: 'lucide:landmark',
    to: '/dashboard/treasury',
    permission: 'treasury.view',
    documentTitle: 'Dashboard - Treasury',
    match: {
      paths: ['/dashboard/treasury']
    }
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'lucide:settings',
    to: '/dashboard/settings',
    permissionsAny: ['settings.view', 'settings.coupons'],
    match: {
      paths: ['/dashboard/settings']
    },
    children: [
      {
        key: 'general',
        label: 'General',
        icon: 'lucide:sliders-horizontal',
        to: '/dashboard/settings',
        permission: 'settings.view',
        documentTitle: 'Dashboard - Settings - General',
        match: {
          paths: ['/dashboard/settings'],
          queryKey: 'tab',
          queryValues: ['']
        }
      },
      {
        key: 'gallery',
        label: 'Gallery',
        icon: 'lucide:images',
        to: '/dashboard/settings?tab=gallery',
        permission: 'settings.view',
        documentTitle: 'Dashboard - Settings - Gallery',
        match: {
          paths: ['/dashboard/settings'],
          queryKey: 'tab',
          queryValues: ['gallery']
        }
      },
      {
        key: 'coupons',
        label: 'Coupon',
        detailedLabel: 'Coupons',
        icon: 'lucide:ticket-percent',
        to: '/dashboard/settings?tab=coupons',
        permission: 'settings.coupons',
        documentTitle: 'Dashboard - Settings - Coupons',
        match: {
          paths: ['/dashboard/settings'],
          queryKey: 'tab',
          queryValues: ['coupons']
        }
      },
      {
        key: 'logs',
        label: 'Log',
        detailedLabel: 'Activity Log',
        icon: 'lucide:scroll-text',
        to: '/dashboard/settings?tab=logs',
        permission: 'settings.view',
        documentTitle: 'Dashboard - Settings - Activity Log',
        match: {
          paths: ['/dashboard/settings'],
          queryKey: 'tab',
          queryValues: ['logs']
        }
      }
    ]
  }
]

const canAccessNavigationItem = (item, access = {}) => {
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
