<template>
  <div>
    <div class="mx-auto max-w-6xl">
      <header class="mb-6 rounded-2xl bg-white p-6 shadow">
        <h2 class="text-4xl font-bold">Dashboard</h2>
        <p class="mt-2 text-sm text-gray-500">{{ viewDescription }}</p>
      </header>

      <DashboardSecondaryNav :items="secondaryNavItems" class="mb-6" />

      <DashboardAnalysisPanel v-if="currentView === 'analysis'" />
      <DashboardAnalysisCustomerExperience v-else-if="currentView === 'customers'" />

      <div v-else class="space-y-6">
        <div v-if="loading && !hasSummary" class="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow">
          Loading summary...
        </div>

        <div v-if="errorMessage" class="rounded-2xl bg-red-50 p-4 text-sm text-red-600 shadow">
          {{ errorMessage }}
        </div>

        <DashboardSummaryOverview
          v-if="currentView === 'summary' && hasSummary"
          :summary="summary"
          :can-see-orders="canSeeOrders"
          :can-see-analysis="canSeeAnalysis"
          :can-see-customers="canSeeCustomers"
        />

        <section v-if="canSeeOrders && currentView !== 'stock'">
          <div class="mb-4 flex items-end justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-gray-900">Orders</h3>
              <p class="mt-1 text-sm text-gray-500">Current workload.</p>
            </div>

            <NuxtLink to="/dashboard/orders" class="text-sm font-semibold text-blue-600 hover:text-blue-700">
              View orders
            </NuxtLink>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DashboardStatCard
              v-for="card in orderCards"
              :key="card.key"
              :label="card.label"
              :value="card.value"
              :icon="card.icon"
              :tone="card.tone"
              to="/dashboard/orders"
            />
          </div>
        </section>

        <section v-if="(canViewProducts || canViewCategories) && currentView !== 'orders'">
          <div class="mb-4 flex items-end justify-between gap-4">
            <div>
              <h3 class="text-2xl font-bold text-gray-900">Catalog</h3>
              <p class="mt-1 text-sm text-gray-500">Products and stock.</p>
            </div>

            <NuxtLink
              v-if="canViewProducts"
              to="/dashboard/products"
              class="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View products
            </NuxtLink>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DashboardStatCard
              v-for="card in catalogCards"
              :key="card.key"
              :label="card.label"
              :value="card.value"
              :icon="card.icon"
              :tone="card.tone"
              :to="card.to"
            />
          </div>
        </section>

        <div
          v-if="!canSeeOrders && !canViewProducts && !canViewCategories && !errorMessage"
          class="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow"
        >
          No summary is available for your permissions.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getDashboardQueryValue } from '~/utils/dashboardNavigation'
import { buildDashboardOverviewLinks } from '~/utils/dashboardOverviewLinks'

definePageMeta({
  layout: 'dashboard'
})

const supabase = useSupabaseClient()
const route = useRoute()
const { getSnapshot, isFresh, setSnapshot } = useDashboardCache()
const { hasPermission } = useAdminAccess()
const DASHBOARD_HOME_CACHE_KEY = 'dashboard:home:v2'

const loading = ref(false)
const errorMessage = ref('')
const hasSummary = ref(false)
const summary = reactive({
  orders: {
    open: 0,
    today: 0,
    awaitingPayment: 0,
    readyToDeliver: 0,
    inDelivery: 0,
    onHold: 0
  },
  catalog: {
    products: 0,
    published: 0,
    drafts: 0,
    outOfStock: 0,
    categories: 0
  },
  users: {
    customers: 0
  }
})

const canViewProducts = computed(() => hasPermission('products.view'))
const canViewCategories = computed(() => hasPermission('categories.view'))
const canSeeAnalysis = computed(() => hasPermission('dashboard.analysis'))
const canSeeOrders = computed(() => hasPermission('dashboard.orders'))
const canSeeCustomers = computed(() => hasPermission('users.view'))
const currentView = computed(() => {
  const view = getDashboardQueryValue(route, 'view')
  return ['analysis', 'customers', 'orders', 'stock'].includes(view) ? view : 'summary'
})
const viewDescription = computed(() => ({ summary: 'Orders, products and stock at a glance.', orders: 'Open orders and delivery progress.', stock: 'Products, availability and categories.', analysis: 'Sales totals and trends over time.', customers: 'Store visits, customer activity and feedback.' })[currentView.value])
const secondaryNavItems = computed(() => buildDashboardOverviewLinks(currentView.value, {
  canSeeAnalysis: canSeeAnalysis.value,
  canSeeOrders: canSeeOrders.value
}))

const orderCards = computed(() => [
  {
    key: 'open',
    label: 'Open Orders',
    value: summary.orders.open,
    icon: 'lucide:inbox',
    tone: 'blue'
  },
  {
    key: 'today',
    label: 'New Today',
    value: summary.orders.today,
    icon: 'lucide:calendar-days',
    tone: 'violet'
  },
  {
    key: 'awaiting-payment',
    label: 'Awaiting Payment',
    value: summary.orders.awaitingPayment,
    icon: 'lucide:credit-card',
    tone: 'amber'
  },
  {
    key: 'ready',
    label: 'Ready to Deliver',
    value: summary.orders.readyToDeliver,
    icon: 'lucide:package-check',
    tone: 'emerald'
  },
  {
    key: 'delivery',
    label: 'In Delivery',
    value: summary.orders.inDelivery,
    icon: 'lucide:truck',
    tone: 'cyan'
  },
  {
    key: 'hold',
    label: 'On Hold',
    value: summary.orders.onHold,
    icon: 'lucide:circle-pause',
    tone: 'rose'
  }
])

const catalogCards = computed(() => {
  const cards = []

  if (canViewProducts.value) {
    cards.push(
      {
        key: 'products',
        label: 'Products',
        value: summary.catalog.products,
        icon: 'lucide:boxes',
        tone: 'slate',
        to: '/dashboard/products'
      },
      {
        key: 'published',
        label: 'Published',
        value: summary.catalog.published,
        icon: 'lucide:circle-check',
        tone: 'emerald',
        to: '/dashboard/products'
      },
      {
        key: 'drafts',
        label: 'Drafts',
        value: summary.catalog.drafts,
        icon: 'lucide:file-pen-line',
        tone: 'amber',
        to: '/dashboard/products'
      },
      {
        key: 'stock',
        label: 'Out of Stock',
        value: summary.catalog.outOfStock,
        icon: 'lucide:package-x',
        tone: 'rose',
        to: '/dashboard/products'
      }
    )
  }

  if (canViewCategories.value) {
    cards.push({
      key: 'categories',
      label: 'Categories',
      value: summary.catalog.categories,
      icon: 'lucide:tags',
      tone: 'violet',
      to: '/dashboard/catalog'
    })
  }

  return cards
})

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session?.access_token) {
    throw new Error('Your session expired. Please log in again.')
  }

  return {
    authorization: `Bearer ${data.session.access_token}`
  }
}

const applySnapshot = (snapshot) => {
  Object.assign(summary.orders, snapshot?.orders || {})
  Object.assign(summary.catalog, snapshot?.catalog || {})
  Object.assign(summary.users, snapshot?.users || {})
  hasSummary.value = true
}

const loadSummary = async ({ force = false } = {}) => {
  const cachedSnapshot = getSnapshot(DASHBOARD_HOME_CACHE_KEY)

  if (cachedSnapshot) {
    applySnapshot(cachedSnapshot)
  }

  if (!force && cachedSnapshot && isFresh(DASHBOARD_HOME_CACHE_KEY)) {
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch('/api/admin-dashboard/summary', {
      headers: await getAuthHeaders()
    })

    applySnapshot(response)
    setSnapshot(DASHBOARD_HOME_CACHE_KEY, response)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Could not load the summary.'
  } finally {
    loading.value = false
  }
}

watch(currentView, async (view) => {
  if (['summary', 'orders', 'stock'].includes(view)) {
    await loadSummary()
  }
})

onMounted(async () => {
  if (['summary', 'orders', 'stock'].includes(currentView.value)) {
    await loadSummary()
  }
})
</script>
