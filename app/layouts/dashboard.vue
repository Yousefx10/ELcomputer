<template>
  <div class="min-h-screen bg-gray-100">
    <div class="mx-auto max-w-6xl px-6 pt-6">
      <header class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
        <NuxtLink to="/dashboard" class="flex items-center">
          <!-- <img
            v-if="dashboardLogoUrl"
            :src="dashboardLogoUrl"
            :alt="dashboardSiteName"
            class="h-10 w-auto object-contain" /> -->
          <img
            src="/images/dashboard-logo.png"
            alt="ELcomputer Dashboard"
            class="h-10 w-auto object-contain"
          >
        </NuxtLink>

        <div class="flex items-center gap-3">
          <div class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
            {{ dashboardDateTime }}
          </div>

          <button
            @click="logout"
            class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      </header>

      <div class="mb-6 rounded-2xl bg-white shadow">
        <LayoutDashboardNavBar />
      </div>

      <main>
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const { data: siteContent } = await useSiteContent()
const {
  clearAdminAccess
} = useAdminAccess()
const dashboardDateTime = ref('')

let dashboardClockInterval
let authStateSubscription

const dashboardRouteTitles = {
  '/dashboard/orders': 'Orders',
  '/dashboard/products': 'Products',
  '/dashboard/products/add': 'Add Product',
  '/dashboard/catalog': 'Catalog',
  '/dashboard/crm': 'CRM',
  '/dashboard/commerce': 'Commerce',
  '/dashboard/hr': 'HR',
  '/dashboard/treasury': 'Treasury',
  '/dashboard/settings': 'Settings'
}

const dashboardTabTitles = {
  '/dashboard/catalog': {
    default: 'Categories',
    brands: 'Brands'
  },
  '/dashboard/commerce': {
    default: 'Procurement',
    procurement: 'Procurement',
    sales: 'Sales',
    shipping: 'Shipping',
    warehouses: 'Warehouses',
    returns: 'Returns'
  },
  '/dashboard/hr': {
    default: 'Employees',
    users: 'Users'
  },
  '/dashboard/settings': {
    gallery: 'Gallery',
    coupons: 'Coupons',
    logs: 'Log'
  }
}

const dashboardDocumentTitle = computed(() => {
  if (route.path === '/dashboard') {
    return route.query.view === 'analysis' ? 'Dashboard - Analysis' : 'Dashboard'
  }

  if (route.path.startsWith('/dashboard/products/edit/')) {
    return 'Dashboard - Edit Product'
  }

  const pageTitle = dashboardRouteTitles[route.path]
  if (!pageTitle) return 'Dashboard'

  const tabTitles = dashboardTabTitles[route.path]
  const tabKey = String(route.query.tab || '')
  const tabTitle = tabTitles?.[tabKey] || (!tabKey ? tabTitles?.default : '')

  return tabTitle
    ? `Dashboard - ${pageTitle} - ${tabTitle}`
    : `Dashboard - ${pageTitle}`
})

useHead(() => ({
  title: dashboardDocumentTitle.value
}))

const dashboardSiteName = computed(() => siteContent.value?.settings?.site_name || 'ELcomputer')
const dashboardLogoUrl = computed(() => siteContent.value?.settings?.site_logo_url || '')

const updateDashboardDateTime = () => {
  dashboardDateTime.value = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date())
}

const logout = async () => {
  clearAdminAccess()
  await supabase.auth.signOut()
  await navigateTo('/dashboard/login')
}

onMounted(() => {
  updateDashboardDateTime()
  dashboardClockInterval = window.setInterval(updateDashboardDateTime, 1000)

  authStateSubscription = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      clearAdminAccess()
      await navigateTo('/dashboard/login')
    }
  }).data.subscription
})

onUnmounted(() => {
  if (dashboardClockInterval) {
    window.clearInterval(dashboardClockInterval)
  }

  if (authStateSubscription) {
    authStateSubscription.unsubscribe()
  }
})
</script>

<style>

</style>
