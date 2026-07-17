<template>
  <header class="w-full">
    <nav class="w-full">
      <ul class="flex w-full flex-wrap justify-center gap-2 p-2 md:flex-nowrap md:gap-0">
        <li
          v-for="link in links"
          :key="link.to"
          class="md:flex-1"
        >
          <NuxtLink
            :to="link.to"
            class="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-center hover:bg-black hover:text-white md:w-full md:rounded-none"
          >
            <Icon :name="link.icon" size="18" />
            <span>{{ link.label }}</span>
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<script setup>
const {
  hasAnyPermission,
  hasPermission,
  loadAdminAccess
} = useAdminAccess()

await loadAdminAccess()

const allLinks = [
  {
    label: 'Home',
    to: '/dashboard',
    icon: 'lucide:house'
  },
  {
    label: 'Products',
    to: '/dashboard/products',
    icon: 'lucide:package',
    permission: 'products.view'
  },
  {
    label: 'Categories',
    to: '/dashboard/products/categories',
    icon: 'lucide:layout-grid',
    permission: 'categories.view'
  },
  {
    label: 'Brands',
    to: '/dashboard/products/brands',
    icon: 'lucide:tag',
    permission: 'brands.view'
  },
  {
    label: 'CRM',
    to: '/dashboard/crm',
    icon: 'lucide:contact-round'
  },
  {
    label: 'Commerce',
    to: '/dashboard/commerce',
    icon: 'lucide:briefcase-business'
  },
  {
    label: 'Settings',
    to: '/dashboard/settings',
    icon: 'lucide:settings',
    permissionsAny: ['settings.view', 'settings.coupons', 'settings.inventory', 'users.view']
  }
]

const links = computed(() => {
  return allLinks.filter((link) => {
    if (link.permissionsAny) {
      return hasAnyPermission(link.permissionsAny)
    }

    if (link.permission) {
      return hasPermission(link.permission)
    }

    return true
  })
})
</script>
