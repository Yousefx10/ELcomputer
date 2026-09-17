<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardPageIntro
      title="Catalog"
      description="Product categories, brands and customer reviews."
    />

    <DashboardSecondaryNav :items="secondaryNavItems" />

    <DashboardCatalogReviewsTab v-if="activeTab === 'reviews'" />
    <DashboardCatalogBrandsTab v-else-if="activeTab === 'brands'" />
    <DashboardCatalogCategoriesTab v-else />
  </div>
</template>

<script setup>
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'

definePageMeta({
  layout: 'dashboard'
})

const route = useRoute()
const { hasPermission } = useAdminAccess()

const canViewCategories = computed(() => hasPermission('categories.view'))
const canViewBrands = computed(() => hasPermission('brands.view'))

const activeTab = computed(() => {
  const requestedTab = getDashboardQueryValue(route, 'tab')

  if (requestedTab === 'reviews') {
    return 'reviews'
  }

  if (requestedTab === 'brands' && canViewBrands.value) {
    return 'brands'
  }

  if (canViewCategories.value) {
    return 'categories'
  }

  if (canViewBrands.value) {
    return 'brands'
  }

  return 'reviews'
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

  items.push({
    label: 'Reviews',
    to: '/dashboard/catalog?tab=reviews',
    active: activeTab.value === 'reviews'
  })

  return items
})
</script>
