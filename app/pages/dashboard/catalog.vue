<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow">
      <h2 class="text-4xl font-bold">Catalog</h2>
      <p class="mt-2 text-sm text-gray-500">
        Manage the categories and brands used by your products.
      </p>
    </div>

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <DashboardCatalogBrandsTab v-if="activeTab === 'brands'" />
    <DashboardCatalogCategoriesTab v-else />
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const { hasPermission } = useAdminAccess()

const canViewCategories = computed(() => hasPermission('categories.view'))
const canViewBrands = computed(() => hasPermission('brands.view'))

const activeTab = computed(() => {
  if (route.query.tab === 'brands' && canViewBrands.value) {
    return 'brands'
  }

  if (canViewCategories.value) {
    return 'categories'
  }

  return 'brands'
})

const secondaryNavItems = computed(() => {
  const items = []

  if (canViewCategories.value) {
    items.push({
      label: 'Categories',
      to: '/dashboard/catalog',
      active: activeTab.value === 'categories'
    })
  }

  if (canViewBrands.value) {
    items.push({
      label: 'Brands',
      to: '/dashboard/catalog?tab=brands',
      active: activeTab.value === 'brands'
    })
  }

  return items
})
</script>
