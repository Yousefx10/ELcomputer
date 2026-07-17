<template>
  <div class="">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Dashboard</h2>
        <p class="mt-2 text-sm text-gray-500">
          Dashboard Overview
        </p>
      </div>

      <DashboardSecondaryNav :items="secondaryNavItems" class="mb-6" />

      <div v-if="currentView === 'summary' && (canViewProducts || canViewCategories)" class="mb-6 grid gap-4 md:grid-cols-2">
        <div v-if="canViewProducts" class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Total Products</p>
          <p class="mt-2 text-3xl font-bold">
            {{ totalProducts }}
          </p>
        </div>

        <div v-if="canViewCategories" class="rounded-2xl bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Total Categories</p>
          <p class="mt-2 text-3xl font-bold">
            {{ totalCategories }}
          </p>
        </div>
      </div>

      <div v-if="currentView === 'summary' && errorMessage" class="mb-6 rounded-2xl bg-red-50 p-4 text-red-600 shadow">
        {{ errorMessage }}
      </div>

      <DashboardAnalysisPanel v-if="currentView === 'analysis'" />

      <div v-else-if="canViewProducts" class="rounded-2xl bg-white p-5 shadow">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-2xl font-bold">Recent Products</h3>
          <NuxtLink
            to="/dashboard/products"
            class="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View all
          </NuxtLink>
        </div>

        <div v-if="loading" class="py-6 text-center text-gray-500">
          Loading dashboard data...
        </div>

        <div v-else-if="!recentProducts.length" class="py-6 text-center text-gray-500">
          No products found yet.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="product in recentProducts"
            :key="product.id"
            class="flex items-center justify-between rounded-xl border p-4"
          >
            <div>
              <p class="font-bold">{{ product.title }}</p>
              <p class="text-sm text-gray-500">
                {{ product.category?.name || 'No Category' }}
              </p>
            </div>

            <NuxtLink
              v-if="canEditProducts"
              :to="`/dashboard/products/edit/${product.id}`"
              class="rounded-lg bg-black px-3 py-2 text-sm text-white"
            >
              Edit
            </NuxtLink>
          </div>
        </div>
      </div>

      <div
        v-else-if="!errorMessage"
        class="rounded-2xl bg-white p-5 text-sm text-gray-500 shadow"
      >
        No dashboard panels are available for your current permissions.
      </div>
    </div>
  </div>
</template>

<script setup>
import { buildDashboardOverviewLinks } from '~/utils/dashboardOverviewLinks'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const route = useRoute()
const { getSnapshot, isFresh, setSnapshot } = useDashboardCache()
const {
  hasPermission
} = useAdminAccess()
const DASHBOARD_HOME_CACHE_KEY = 'dashboard:home'

const totalProducts = ref(0)
const totalCategories = ref(0)
const activeProducts = ref(0)
const inactiveProducts = ref(0)
const recentProducts = ref([])
const loading = ref(false)
const errorMessage = ref('')
const canViewProducts = computed(() => hasPermission('products.view'))
const canViewCategories = computed(() => hasPermission('categories.view'))
const canEditProducts = computed(() => hasPermission('products.edit'))
const canSeeAnalysis = computed(() => hasPermission('dashboard.analysis'))
const canSeeOrders = computed(() => hasPermission('dashboard.orders'))
const currentView = computed(() => {
  return route.query.view === 'analysis' ? 'analysis' : 'summary'
})
const secondaryNavItems = computed(() => buildDashboardOverviewLinks(currentView.value, {
  canSeeAnalysis: canSeeAnalysis.value,
  canSeeOrders: canSeeOrders.value
}))

const applyDashboardSnapshot = (snapshot) => {
  totalProducts.value = snapshot?.totalProducts || 0
  totalCategories.value = snapshot?.totalCategories || 0
  activeProducts.value = snapshot?.activeProducts || 0
  inactiveProducts.value = snapshot?.inactiveProducts || 0
  recentProducts.value = snapshot?.recentProducts || []
}

const getDashboardData = async ({ force = false } = {}) => {
  const cachedSnapshot = getSnapshot(DASHBOARD_HOME_CACHE_KEY)

  if (cachedSnapshot) {
    applyDashboardSnapshot(cachedSnapshot)
  }

  if (!canViewProducts.value && !canViewCategories.value) {
    applyDashboardSnapshot({
      totalProducts: 0,
      totalCategories: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      recentProducts: []
    })
    setSnapshot(DASHBOARD_HOME_CACHE_KEY, {
      totalProducts: 0,
      totalCategories: 0,
      activeProducts: 0,
      inactiveProducts: 0,
      recentProducts: []
    })
    loading.value = false
    return
  }

  if (!force && cachedSnapshot && isFresh(DASHBOARD_HOME_CACHE_KEY)) {
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  const [productsCountResult, activeProductsResult, inactiveProductsResult, categoriesCountResult, recentProductsResult] = await Promise.all([
    canViewProducts.value
      ? supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
      : Promise.resolve({ count: 0, error: null }),
    canViewProducts.value
      ? supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_published', true)
      : Promise.resolve({ count: 0, error: null }),
    canViewProducts.value
      ? supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_published', false)
      : Promise.resolve({ count: 0, error: null }),
    canViewCategories.value
      ? supabase
          .from('categories')
          .select('*', { count: 'exact', head: true })
      : Promise.resolve({ count: 0, error: null }),
    canViewProducts.value
      ? supabase
          .from('products')
          .select(`
            id,
            title,
            category:categories (
              name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null })
  ])

  loading.value = false

  if (productsCountResult.error) {
    errorMessage.value = productsCountResult.error.message
    return
  }

  if (activeProductsResult.error) {
    errorMessage.value = activeProductsResult.error.message
    return
  }

  if (inactiveProductsResult.error) {
    errorMessage.value = inactiveProductsResult.error.message
    return
  }

  if (categoriesCountResult.error) {
    errorMessage.value = categoriesCountResult.error.message
    return
  }

  if (recentProductsResult.error) {
    errorMessage.value = recentProductsResult.error.message
    return
  }

  const snapshot = {
    totalProducts: productsCountResult.count || 0,
    activeProducts: activeProductsResult.count || 0,
    inactiveProducts: inactiveProductsResult.count || 0,
    totalCategories: categoriesCountResult.count || 0,
    recentProducts: recentProductsResult.data || []
  }

  applyDashboardSnapshot(snapshot)
  setSnapshot(DASHBOARD_HOME_CACHE_KEY, snapshot)
}

watch(currentView, async (view) => {
  if (view === 'summary') {
    await getDashboardData()
  }
})

onMounted(async () => {
  if (currentView.value === 'summary') {
    await getDashboardData()
  }
})
</script>
